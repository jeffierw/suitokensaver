const unknown = (reason) => ({ status: 'unverifiable', amount: null, reason });
const uint = (value) => typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) <= 18446744073709551615n;

export function classifyLocked(nft, locked, config, chainTime) {
  if (!nft || !uint(nft.initial_allocation) || typeof nft.allocation_withdrawn !== 'boolean') {
    return unknown('The NFT fields could not be verified.');
  }
  if (nft.allocation_withdrawn) {
    return { status: 'claimed', amount: nft.initial_allocation, reason: 'The official NFT records this allocation as withdrawn.' };
  }
  if (!locked || locked.nft !== nft.id || locked.id !== nft.locked_id || !uint(locked.balance)) {
    return unknown('The matching funding object is missing or could not be verified.');
  }
  if (!config || !('unlock_timestamp_ms' in config) || !uint(config.recovery_timestamp_ms) || !Number.isFinite(chainTime)) {
    return unknown('The current claim configuration could not be verified.');
  }
  const unlock = config.unlock_timestamp_ms;
  if (unlock === null) {
    return { status: 'locked', amount: locked.balance, reason: 'On-chain claiming has not been enabled.' };
  }
  if (!uint(unlock)) return unknown('Invalid on-chain unlock timestamp.');
  const recoveryAvailable = BigInt(chainTime) >= BigInt(config.recovery_timestamp_ms);
  const timestamps = { unlockAt: Number(unlock), recoveryAt: Number(config.recovery_timestamp_ms), recoveryAvailable };
  if (BigInt(chainTime) < BigInt(unlock)) {
    return { status: 'locked', amount: locked.balance, ...timestamps, reason: 'This allocation has not reached its on-chain unlock time.' };
  }
  if (BigInt(locked.balance) === 0n) return { status: 'empty', amount: '0', ...timestamps, reason: 'The funding object has no remaining balance.' };
  return {
    status: 'claimable', amount: locked.balance, ...timestamps,
    reason: recoveryAvailable
      ? 'Funds remain on-chain, but the administrator can now recover them. Recheck before claiming.'
      : 'An unclaimed NFT and its matching funded object are present; on-chain claiming is enabled.',
  };
}

export function classifyWrapper(fields, receipt) {
  const amount = receipt ? fields?.amount : fields?.balance;
  if (!uint(amount)) return unknown('The official object balance could not be verified.');
  return {
    status: receipt ? 'claimed' : BigInt(amount) > 0n ? 'claimable' : 'empty',
    amount,
    reason: receipt ? 'An official receipt records a completed claim.'
      : BigInt(amount) > 0n ? 'The unredeemed official wrapper contains this token balance.' : 'The wrapper balance is zero.',
  };
}

export function walRound(createdAt) {
  const date = Date.parse(createdAt);
  if (date >= Date.parse('2025-02-19') && date < Date.parse('2025-04-01')) return 'wal-launch';
  if (date >= Date.parse('2025-08-01') && date < Date.parse('2025-09-01')) return 'wal-stakers';
  return 'wal-unknown';
}
