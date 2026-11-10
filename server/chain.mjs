import { normalizeInput } from '../shared/validation.mjs';

const endpoint = process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql';
export const providerLabel = process.env.SUI_PROVIDER_LABEL || 'Sui Mainnet GraphQL';
let active = 0;
const waiting = [];

async function limited(task) {
  if (active >= 4) {
    if (waiting.length >= 120) throw new Error('RPC queue is busy. Please retry shortly.');
    await new Promise((resolve) => waiting.push(resolve));
  }
  active++;
  try { return await task(); }
  finally {
    active--;
    waiting.shift()?.();
  }
}

export async function queryChain(query, variables = {}) {
  return limited(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.SUI_GRAPHQL_API_KEY) headers[process.env.SUI_GRAPHQL_KEY_HEADER || 'x-api-key'] = process.env.SUI_GRAPHQL_API_KEY;
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST', headers, body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(18000),
        });
      } catch {
        throw new Error('The mainnet data provider could not be reached. Retry this address.');
      }
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      if (!response.ok) throw new Error(`Mainnet data provider returned HTTP ${response.status}.`);
      const result = await response.json();
      if (result.errors?.length || !result.data) throw new Error('The mainnet query was incomplete. Retry this address.');
      return result.data;
    }
  });
}

export async function readAllPages(readPage) {
  const objects = [];
  const seen = new Set();
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const result = await readPage(cursor);
    if (!Array.isArray(result?.nodes) || typeof result.pageInfo?.hasNextPage !== 'boolean') {
      throw new Error('Invalid object pagination response.');
    }
    objects.push(...result.nodes);
    if (!result.pageInfo.hasNextPage) return objects;
    const next = result.pageInfo.endCursor;
    if (!next || seen.has(next)) throw new Error('Invalid object pagination cursor.');
    seen.add(next);
    cursor = next;
  }
  throw new Error('Object pagination limit reached; this result is incomplete.');
}

export async function getHead() {
  const data = await queryChain('{ checkpoint { sequenceNumber timestamp } }');
  const time = Date.parse(data.checkpoint?.timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 300000) {
    throw new Error('The mainnet provider returned a stale or invalid checkpoint.');
  }
  return { ...data.checkpoint, time };
}

export function validateNameRecord(record, chainTime) {
  if (!record) throw new Error('SuiNS name not found.');
  const target = record.target?.address;
  if (!target || normalizeInput(target).kind !== 'address') throw new Error('This SuiNS name has no valid target address.');
  const expiry = Number(record.contents?.json?.expiration_timestamp_ms);
  if (!Number.isFinite(expiry)) throw new Error('SuiNS expiry could not be verified.');
  if (expiry <= chainTime) throw new Error('This SuiNS name has expired.');
  return target;
}

export async function resolveName(name) {
  const data = await queryChain(`query($name:String!){
    checkpoint { timestamp }
    nameRecord(name:$name){ target{address} contents{json}
      parent { contents{json} parent { contents{json} } }
    }
  }`, { name });
  const record = data.nameRecord;
  const time = Date.parse(data.checkpoint?.timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 300000) throw new Error('SuiNS resolver is behind mainnet. Retry shortly.');
  const address = validateNameRecord(record, time);
  let parent = record?.parent;
  while (parent) {
    const expiry = Number(parent.contents?.json?.expiration_timestamp_ms);
    if (!Number.isFinite(expiry) || expiry <= time) throw new Error('The parent SuiNS name is expired or unverifiable.');
    parent = parent.parent;
  }
  return address;
}

export async function getOwned(address, type) {
  return readAllPages(async (cursor) => {
    const data = await queryChain(`query($address:SuiAddress!,$type:String!,$cursor:String){
      address(address:$address){objects(first:50,after:$cursor,filter:{type:$type}){
        nodes{address version owner{__typename ... on AddressOwner{address{address}}} contents{type{repr} json}}
        pageInfo{hasNextPage endCursor}
      }}
    }`, { address, type, cursor });
    return data.address?.objects;
  });
}

export async function getObject(address) {
  const data = await queryChain(`query($address:SuiAddress!){
    object(address:$address){address version owner{__typename}
      asMoveObject{contents{type{repr}json}}
    }
  }`, { address });
  const object = data.object;
  return object ? { ...object, contents: object.asMoveObject?.contents } : null;
}

const creationCache = new Map();
export async function getCreation(address) {
  if (creationCache.has(address)) return creationCache.get(address);
  const data = await queryChain(`query($address:SuiAddress!){
    objectVersions(address:$address,first:1){nodes{version previousTransaction{digest effects{timestamp}}}}
  }`, { address });
  const transaction = data.objectVersions?.nodes?.[0]?.previousTransaction;
  if (!transaction?.effects?.timestamp) throw new Error('Creation history is unavailable.');
  const creation = { digest: transaction.digest, timestamp: transaction.effects.timestamp };
  if (creationCache.size >= 2000) creationCache.delete(creationCache.keys().next().value);
  creationCache.set(address, creation);
  return creation;
}
