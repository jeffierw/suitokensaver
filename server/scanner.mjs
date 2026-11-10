import { CAMPAIGNS, SOURCES, UNKNOWN_WAL } from '../shared/campaigns.mjs';
import { normalizeInput } from '../shared/validation.mjs';
import { classifyLocked, classifyWrapper, walRound } from './classify.mjs';
import { getHead, getOwned, getObject, getCreation, providerLabel } from './chain.mjs';

export async function scanAddress(address) {
  if (normalizeInput(address).kind !== 'address') throw new Error('A full normalized Sui address is required.');
  const head = await getHead();
  const groups = new Map([...CAMPAIGNS, UNKNOWN_WAL].map((campaign) => [campaign.id, {
    campaignId: campaign.id, items: [], errors: [], complete: true,
  }]));
  for (const source of SOURCES) {
    try {
      const objects = await getOwned(address, source.type);
      let config;
      if (source.configId && objects.some((object) => object.contents?.json?.allocation_withdrawn !== true)) {
        config = await getObject(source.configId);
        if (config?.contents?.type?.repr !== `${source.packageId}::config::AirdropConfig`) {
          throw new Error('The official claim configuration could not be verified.');
        }
      }
      for (const object of objects) {
        let campaignId = source.campaigns[0];
        let creation = null;
        let classificationWarning = null;
        if (source.id === 'wal') {
          try {
            creation = await getCreation(object.address);
            campaignId = walRound(creation.timestamp);
          } catch {
            campaignId = 'wal-unknown';
          }
          if (campaignId === 'wal-unknown') {
            classificationWarning = 'Official WAL NFT found, but its distribution round could not be verified.';
            for (const id of source.campaigns) {
              groups.get(id).complete = false;
              groups.get(id).errors.push('Some WAL NFTs could not be assigned to a distribution round.');
            }
          }
        }
        const fields = object.contents?.json;
        const item = {
          objectId: object.address, type: object.contents?.type?.repr,
          version: object.version, campaignId, creation, classificationWarning,
          configId: source.configId || null,
        };
        try {
          if (object.contents?.type?.repr !== source.type || fields?.id !== object.address
              || object.owner?.__typename !== 'AddressOwner' || object.owner.address?.address !== address) {
            throw new Error('Object type or ownership changed during the query. Rescan this address.');
          }
          if (source.kind === 'locked') {
            let locked = null;
            if (fields.allocation_withdrawn === false) {
              if (normalizeInput(fields.locked_id).kind !== 'address') throw new Error('The NFT contains an invalid funding object ID.');
              locked = await getObject(fields.locked_id);
              if (locked && (locked.contents?.type?.repr !== `${source.packageId}::airdrop::Locked`
                || locked.owner?.__typename !== 'Shared')) throw new Error('The associated funding object has an unexpected type or owner.');
            }
            item.lockedId = fields.locked_id;
            Object.assign(item, classifyLocked(fields, locked?.contents?.json, config?.contents?.json, head.time));
          } else {
            Object.assign(item, classifyWrapper(fields, source.kind === 'receipt'));
          }
        } catch (error) {
          Object.assign(item, { status: 'unverifiable', amount: null, reason: error.message });
        }
        groups.get(campaignId).items.push(item);
      }
    } catch (error) {
      for (const id of source.campaigns) {
        groups.get(id).complete = false;
        groups.get(id).errors.push(error.message);
      }
    }
  }
  const results = [...groups.values()].filter((group) => group.campaignId !== 'wal-unknown' || group.items.length);
  for (const group of results) {
    group.errors = [...new Set(group.errors)];
    if (group.items.some((item) => item.status === 'unverifiable')) group.complete = false;
  }
  return {
    address, network: 'mainnet', source: providerLabel, checkedAt: new Date().toISOString(),
    checkpoint: head.sequenceNumber, checkpointTime: head.timestamp,
    complete: results.every((group) => group.complete),
    groups: results,
  };
}
