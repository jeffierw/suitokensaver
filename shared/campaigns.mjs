export const WAL_PACKAGE = '0x98af8b8fde88f3c4bdf0fcedcf9afee7d10f66d480b74fb5a3a2e23dc7f5a564';
export const DEEP_S1_PACKAGE = '0x7c28438735d3314fe1c48ce74e3131eb2025fa21694bd1c58b0fd12753974c2f';
export const DEEP_ORIGIN = '0x61c9c39fd86185ad60d738d4e52bd08bda071d366acde07e07c3916a2d75a816';
export const NS_ORIGIN = '0x220bca2187856d09aae578e2782b2b484049a32c755d20352e01236ba5368b63';

export const CAMPAIGNS = [
  { id: 'wal-launch', symbol: 'WAL', name: 'Walrus', round: 'Launch airdrop', date: 'March 2025', decimals: 9, color: 'wal', url: 'https://claim.walrus.xyz/', packageId: WAL_PACKAGE },
  { id: 'wal-stakers', symbol: 'WAL', name: 'Walrus', round: 'Staker airdrop', date: 'August 2025', decimals: 9, color: 'wal', url: 'https://claim.walrus.xyz/', packageId: WAL_PACKAGE },
  { id: 'deep-launch', symbol: 'DEEP', name: 'DeepBook', round: 'Initial airdrop', date: 'October 2024', decimals: 6, color: 'deep', url: null, packageId: '0xc2cfa18b841df1887d931055cf41f2773c58164f719675595d020829893188a5' },
  { id: 'deep-s1', symbol: 'DEEP', name: 'DeepBook', round: 'Season 1', date: 'June 2026', decimals: 6, color: 'deep', url: null, packageId: DEEP_S1_PACKAGE },
  { id: 'ns-launch', symbol: 'NS', name: 'SuiNS', round: 'Community airdrop', date: 'November 2024', decimals: 6, color: 'ns', url: 'https://claim.suins.io/', packageId: '0x3ca2fdfc90c262f5a7323cdf10f4a8960a2640a18abc0c8405b15ad7186be8f0' },
];
export const UNKNOWN_WAL = { ...CAMPAIGNS[0], id: 'wal-unknown', round: 'Unclassified distribution', date: 'Creation history unavailable' };

export const SOURCES = [
  { id: 'wal', campaigns: ['wal-launch', 'wal-stakers'], type: `${WAL_PACKAGE}::airdrop::WALAirdrop`, kind: 'locked', packageId: WAL_PACKAGE, configId: '0x194ddb7dcc480aabc981d976c6327a7bb610de0d7aa6e2c29783cf9d59da7bb3' },
  { id: 'deep-s1', campaigns: ['deep-s1'], type: `${DEEP_S1_PACKAGE}::airdrop::DEEPAirdrop`, kind: 'locked', packageId: DEEP_S1_PACKAGE, configId: '0xa1a4a2e42663a5b7b74e94da4e24bb4c8467343b051ab7509b25f6200481aee5' },
  { id: 'deep-wrapper', campaigns: ['deep-launch'], type: `${DEEP_ORIGIN}::distribution::DEEPWrapper`, kind: 'wrapper' },
  { id: 'deep-receipt', campaigns: ['deep-launch'], type: `${CAMPAIGNS[2].packageId}::distribution::DEEPAirdrop`, kind: 'receipt' },
  { id: 'ns-wrapper', campaigns: ['ns-launch'], type: `${NS_ORIGIN}::distribution::NSWrapper`, kind: 'wrapper' },
  { id: 'ns-receipt', campaigns: ['ns-launch'], type: `${CAMPAIGNS[4].packageId}::distribution::NSAirdrop`, kind: 'receipt' },
];
