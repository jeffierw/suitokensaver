import { CAMPAIGNS, SOURCES } from '../shared/campaigns.mjs';
import { classifyLocked, classifyWrapper, walRound } from '../server/classify.mjs';

export const SNAPSHOT_SOURCES = SOURCES.filter((source) => source.kind !== 'receipt');
const addressPattern = /^0x[0-9a-f]{64}$/;
const fields = (object) => object?.asMoveObject?.contents?.json;
const typeOf = (object) => object?.asMoveObject?.contents?.type?.repr;
const selection = 'address version owner{__typename ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr}json}}';

export function makeRpc(query) {
  async function at(checkpoint, body, variables = {}, declarations = '') {
    const data = await query(`query($checkpoint:UInt53!${declarations}){
      checkpoint(sequenceNumber:$checkpoint){query{${body}}}
    }`, { ...variables, checkpoint });
    if (!data?.checkpoint?.query) throw new Error('Snapshot checkpoint unavailable.');
    return data.checkpoint.query;
  }
  return {
    async head() {
      const data = await query('{checkpoint{sequenceNumber timestamp}}');
      const head = data.checkpoint;
      if (!Number.isSafeInteger(head?.sequenceNumber) || !Number.isFinite(Date.parse(head?.timestamp))
          || Math.abs(Date.now() - Date.parse(head.timestamp)) > 300000) throw new Error('Invalid or stale snapshot checkpoint.');
      return head;
    },
    async page(type, checkpoint, cursor) {
      return (await at(checkpoint, `objects(first:50,after:$cursor,filter:{type:$type}){
        nodes{${selection}}pageInfo{hasNextPage endCursor}
      }`, { type, cursor }, ',$type:String!,$cursor:String')).objects;
    },
    async objects(addresses, checkpoint) {
      if (!addresses.length) return [];
      return (await at(checkpoint, `multiGetObjects(keys:$keys){${selection}}`,
        { keys: addresses.map((address) => ({ address })) }, ',$keys:[ObjectKey!]!')).multiGetObjects;
    },
    async creation(address, checkpoint) {
      const data = await at(checkpoint, 'objectVersions(address:$address,first:1){nodes{previousTransaction{digest effects{timestamp}}}}',
        { address }, ',$address:SuiAddress!');
      const transaction = data.objectVersions?.nodes?.[0]?.previousTransaction;
      return transaction?.effects?.timestamp ? { digest: transaction.digest, timestamp: transaction.effects.timestamp } : null;
    },
    async creations(addresses, checkpoint) {
      const results = new Map();
      for (let offset = 0; offset < addresses.length; offset += 10) {
        const batch = addresses.slice(offset, offset + 10);
        const declarations = batch.map((_, index) => `,$id${index}:SuiAddress!`).join('');
        const variables = Object.fromEntries(batch.map((address, index) => [`id${index}`, address]));
        const body = batch.map((_, index) => `item${index}:objectVersions(address:$id${index},first:1){nodes{previousTransaction{digest effects{timestamp}}}}`).join('\n');
        const data = await at(checkpoint, body, variables, declarations);
        batch.forEach((address, index) => {
          const tx = data[`item${index}`]?.nodes?.[0]?.previousTransaction;
          if (tx?.effects?.timestamp) results.set(address, { digest: tx.digest, timestamp: tx.effects.timestamp });
        });
      }
      return results;
    },
  };
}

export function createTransport(env = {}) {
  const endpoint = env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql';
  return async (query, variables = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (env.SUI_GRAPHQL_API_KEY) headers[env.SUI_GRAPHQL_KEY_HEADER || 'x-api-key'] = env.SUI_GRAPHQL_API_KEY;
    const response = await fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Snapshot provider HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors?.length || !result.data) throw new Error('Snapshot query failed; checkpoint or provider unavailable.');
    return result.data;
  };
}

export async function collectPage({ sourceId, checkpoint, cursor }, rpc) {
  const source = SNAPSHOT_SOURCES.find((entry) => entry.id === sourceId);
  if (!source || !Number.isSafeInteger(checkpoint?.sequenceNumber) || !Number.isFinite(Date.parse(checkpoint.timestamp))) throw new Error('Invalid snapshot source/checkpoint.');
  const type = source.kind === 'locked' ? `${source.packageId}::airdrop::Locked` : source.type;
  const page = await rpc.page(type, checkpoint.sequenceNumber, cursor);
  if (!Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean'
      || (page.pageInfo.hasNextPage && (!page.pageInfo.endCursor || page.pageInfo.endCursor === cursor))) {
    throw new Error('Invalid snapshot pagination.');
  }
  const refs = source.kind === 'locked'
    ? [...new Set(page.nodes.map((object) => fields(object)?.nft).filter((id) => addressPattern.test(id || ''))), source.configId] : [];
  const fetched = refs.length ? await rpc.objects(refs, checkpoint.sequenceNumber) : [];
  if (!Array.isArray(fetched) || fetched.length !== refs.length) throw new Error('Incomplete snapshot object join.');
  const objects = new Map(fetched.filter(Boolean).map((object) => [object.address, object]));
  let creations;
  if (sourceId === 'wal' && rpc.creations) {
    try { creations = await rpc.creations(refs.filter((id) => id !== source.configId), checkpoint.sequenceNumber); }
    catch { creations = new Map(); }
  }
  const records = [];
  const unresolved = [];
  for (const object of page.nodes) {
    try {
      if (!addressPattern.test(object?.address || '') || fields(object)?.id !== object.address || typeOf(object) !== type) throw new Error('Candidate object identity mismatch.');
      let nft = object;
      let classification;
      if (source.kind === 'locked') {
        nft = objects.get(fields(object).nft);
        const config = objects.get(source.configId);
        if (object.owner?.__typename !== 'Shared' || typeOf(nft) !== source.type || fields(nft)?.id !== nft?.address
            || fields(nft)?.allocation_withdrawn !== false
            || typeOf(config) !== `${source.packageId}::config::AirdropConfig` || config.owner?.__typename !== 'Shared') {
          throw new Error('NFT, funds or configuration cannot be verified.');
        }
        classification = classifyLocked(fields(nft), fields(object), fields(config), Date.parse(checkpoint.timestamp));
      } else {
        classification = classifyWrapper(fields(nft), false);
      }
      const owner = nft?.owner?.address?.address;
      if (nft?.owner?.__typename !== 'AddressOwner' || !addressPattern.test(owner || '')) throw new Error('No direct address owner; allocation excluded.');
      if (classification.status === 'unverifiable') throw new Error(classification.reason);
      if (!['claimable', 'locked'].includes(classification.status) || BigInt(classification.amount) === 0n) continue;
      let campaignId = source.campaigns[0];
      let creation = null;
      if (sourceId === 'wal') {
        try { creation = creations ? creations.get(nft.address) || null : await rpc.creation(nft.address, checkpoint.sequenceNumber); } catch { creation = null; }
        campaignId = walRound(creation?.timestamp);
      }
      const token = CAMPAIGNS.find((campaign) => campaign.id === source.campaigns[0]);
      records.push({
        objectId: nft.address, fundingId: source.kind === 'locked' ? object.address : null,
        address: owner, symbol: token.symbol, decimals: token.decimals, campaignId,
        status: classification.status, amount: classification.amount,
        recoveryAvailable: classification.recoveryAvailable || false,
        recoveryAt: classification.recoveryAt ?? null, creation,
      });
    } catch (error) {
      unresolved.push({ sourceId, objectId: object?.address || null, reason: error.message });
    }
  }
  return { records, unresolved, scanned: page.nodes.length, ...page.pageInfo };
}
