export const LOCALES = [
  ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
  ['ja', '日本語'], ['ko', '한국어'], ['fr', 'Français'], ['uk', 'Українська'],
];

const en = {
  'Language': 'Language', 'Sui Mainnet': 'Sui Mainnet', 'READ-ONLY SCANNER': 'READ-ONLY SCANNER',
  'Unclaimed on Sui': 'Unclaimed on Sui', 'An old wallet may still have something waiting.': 'An old wallet may still have something waiting.',
  'Airdrop announcements come and go. Wallets get forgotten. But an unclaimed WAL, DEEP or NS allocation may still be there, even if you missed the original claim window.': 'Airdrop announcements come and go. Wallets get forgotten. But an unclaimed WAL, DEEP or NS allocation may still be there, even if you missed the original claim window.',
  'Addresses or SuiNS names': 'Addresses or SuiNS names', 'No wallet connection or signature': 'No wallet connection or signature',
  'Scanning': 'Scanning', 'Scan addresses': 'Scan addresses', 'Cancel scan': 'Cancel scan', 'Scan results': 'Scan results',
  'Status': 'Status', 'All statuses': 'All statuses', 'Amounts are in tokens, not USD': 'Amounts are in tokens, not USD',
  'All distributions': 'All distributions', 'Browse addresses': 'Browse addresses', 'Airdrop overview': 'Airdrop overview',
  'SUPPORTED AIRDROP DISTRIBUTIONS': 'SUPPORTED AIRDROP DISTRIBUTIONS', 'Still waiting on-chain': 'Still waiting on-chain',
  'Airdrop distributions': 'Airdrop distributions', 'Distribution': 'Distribution', 'Allocation state': 'Allocation state',
  'Reference value': 'Reference value', 'Priced subtotal': 'Priced subtotal', 'Price unavailable': 'Price unavailable',
  'No current prices': 'No current prices', 'Excludes {tokens}': 'Excludes {tokens}',
  'USDC reference; assumes 1 USDC = 1 USD. Not expected sale proceeds.': 'USDC reference; assumes 1 USDC = 1 USD. Not expected sale proceeds.',
  'Reference quote': 'Reference quote', 'Refreshing prices': 'Refreshing prices',
  'Updated daily after 02:00 UTC. Completed: {time}': 'Updated daily after 02:00 UTC. Completed: {time}',
  'Chain snapshot: {time} / Checkpoint {checkpoint}': 'Chain snapshot: {time} / Checkpoint {checkpoint}',
  'Price: {time} / {source}': 'Price: {time} / {source}', 'Holder addresses': 'Holder addresses',
  'Unclaimed allocations': 'Unclaimed allocations', '{count} addresses': '{count} addresses',
  '{amount} {token} in this category': '{amount} {token} in this category', 'Page {page} of {pages}': 'Page {page} of {pages}',
  'Unclaimed amount': 'Unclaimed amount', 'Estimate / USD': 'Estimate / USD', 'Allocations': 'Allocations',
  'All rounds': 'All rounds', 'Unlocked': 'Unlocked', 'Locked': 'Locked', 'Loading global snapshot...': 'Loading global snapshot...',
  'Loading addresses...': 'Loading addresses...', 'No verified allocations in this category at this checkpoint.': 'No verified allocations in this category at this checkpoint.',
  'Refresh snapshot': 'Refresh snapshot', 'Previous page': 'Previous page', 'Next page': 'Next page',
  'Verify address on-chain': 'Verify address on-chain', 'Object evidence': 'Object evidence', 'Live verification': 'Live verification',
  'Close live verification': 'Close live verification', 'Reading mainnet...': 'Reading mainnet...',
  'Support this free tool': 'Support this free tool', 'Found this useful? Support its upkeep:': 'Found this useful? Support its upkeep:',
  'Copy support address': 'Copy support address', 'Copied': 'Copied', 'Copy address': 'Copy address', 'Copy failed': 'Copy failed',
  'Claimed': 'Claimed', 'Unclaimed': 'Unclaimed', 'Empty': 'Empty', 'Unverified': 'Unverified',
  'No matching object currently held.': 'No matching object currently held.', 'Incomplete verification.': 'Incomplete verification.',
  'Known distributions only': 'Known distributions only', 'Snapshot overdue': 'Snapshot overdue',
};

function merge(overrides) { return { ...en, ...overrides }; }
export const DICTIONARIES = {
  en,
  'zh-CN': merge({
    'Language': '语言', 'READ-ONLY SCANNER': '只读扫描器', 'Unclaimed on Sui': 'Sui 上尚未领取的空投',
    'An old wallet may still have something waiting.': '旧钱包里可能还有等待领取的资产。',
    'Addresses or SuiNS names': '地址或 SuiNS 名称', 'No wallet connection or signature': '无需连接钱包或签名',
    'Scanning': '扫描中', 'Scan addresses': '扫描地址', 'Cancel scan': '取消扫描', 'Scan results': '扫描结果',
    'Status': '状态', 'All statuses': '全部状态', 'Amounts are in tokens, not USD': '金额以代币计，不是美元',
    'All distributions': '全部分发', 'Browse addresses': '查看地址', 'Airdrop overview': '空投概览',
    'SUPPORTED AIRDROP DISTRIBUTIONS': '支持的空投分发', 'Still waiting on-chain': '仍在链上等待领取',
    'Airdrop distributions': '空投分发', 'Distribution': '分发批次', 'Allocation state': '分配状态',
    'Reference value': '参考估值', 'Priced subtotal': '已定价部分估值', 'Price unavailable': '价格暂不可用',
    'No current prices': '暂无有效价格', 'Excludes {tokens}': '不含 {tokens}',
    'USDC reference; assumes 1 USDC = 1 USD. Not expected sale proceeds.': 'USDC 参考价，假设 1 USDC = 1 USD；不代表实际可出售所得。',
    'Reference quote': '参考报价', 'Refreshing prices': '正在更新价格',
    'Updated daily after 02:00 UTC. Completed: {time}': '每日 02:00 UTC 后更新。完成时间：{time}',
    'Chain snapshot: {time} / Checkpoint {checkpoint}': '链上快照：{time} / 检查点 {checkpoint}',
    'Price: {time} / {source}': '价格：{time} / {source}', 'Holder addresses': '持有地址',
    'Unclaimed allocations': '未领取分配', '{count} addresses': '{count} 个地址',
    '{amount} {token} in this category': '本分类共 {amount} {token}', 'All rounds': '全部批次',
    'Unlocked': '已解锁', 'Locked': '锁定中', 'Loading global snapshot...': '正在加载全局快照…',
    'Loading addresses...': '正在加载地址…', 'Refresh snapshot': '刷新快照',
    'Support this free tool': '支持这个免费工具', 'Found this useful? Support its upkeep:': '觉得有用？支持维护：',
    'Claimed': '已领取', 'Unclaimed': '未领取', 'Empty': '空', 'Unverified': '未验证',
  }),
  'zh-TW': merge({
    'Language': '語言', 'READ-ONLY SCANNER': '唯讀掃描器', 'Unclaimed on Sui': 'Sui 上尚未領取的空投',
    'Addresses or SuiNS names': '地址或 SuiNS 名稱', 'Scan addresses': '掃描地址', 'Scan results': '掃描結果',
    'All distributions': '所有分發', 'Browse addresses': '查看地址', 'Airdrop overview': '空投概覽',
    'SUPPORTED AIRDROP DISTRIBUTIONS': '支援的空投分發', 'Still waiting on-chain': '仍在鏈上等待領取',
    'Airdrop distributions': '空投分發', 'Distribution': '分發批次', 'Allocation state': '分配狀態',
    'Reference value': '參考估值', 'Priced subtotal': '已定價部分估值', 'Price unavailable': '價格暫不可用',
    'No current prices': '暫無有效價格', 'Excludes {tokens}': '不含 {tokens}', 'Unlocked': '已解鎖', 'Locked': '鎖定中',
    'Support this free tool': '支持這個免費工具', 'Found this useful? Support its upkeep:': '覺得有用？支持維護：',
    'Claimed': '已領取', 'Unclaimed': '未領取', 'Empty': '空', 'Unverified': '未驗證',
  }),
  ja: merge({
    'Language': '言語', 'READ-ONLY SCANNER': '読み取り専用スキャナー', 'Unclaimed on Sui': 'Sui の未請求エアドロップ',
    'Addresses or SuiNS names': 'アドレスまたは SuiNS 名', 'Scan addresses': 'アドレスを確認', 'Scan results': '確認結果',
    'All distributions': 'すべての配布', 'Browse addresses': 'アドレス一覧', 'Airdrop overview': 'エアドロップ概要',
    'SUPPORTED AIRDROP DISTRIBUTIONS': '対応するエアドロップ配布', 'Still waiting on-chain': 'オンチェーンで未請求',
    'Airdrop distributions': 'エアドロップ配布', 'Distribution': '配布', 'Allocation state': '割当状態',
    'Reference value': '参考評価額', 'Priced subtotal': '価格取得分の小計', 'Price unavailable': '価格情報なし',
    'No current prices': '有効な価格情報なし', 'Excludes {tokens}': '{tokens} を除く', 'Unlocked': '解除済み', 'Locked': 'ロック中',
    'Support this free tool': '無料ツールを支援', 'Found this useful? Support its upkeep:': '役に立ちましたか？運営を支援：',
    'Claimed': '請求済み', 'Unclaimed': '未請求', 'Empty': 'なし', 'Unverified': '未検証',
  }),
  ko: merge({
    'Language': '언어', 'READ-ONLY SCANNER': '읽기 전용 스캐너', 'Unclaimed on Sui': 'Sui 미수령 에어드롭',
    'Addresses or SuiNS names': '주소 또는 SuiNS 이름', 'Scan addresses': '주소 조회', 'Scan results': '조회 결과',
    'All distributions': '모든 배포', 'Browse addresses': '주소 보기', 'Airdrop overview': '에어드롭 개요',
    'SUPPORTED AIRDROP DISTRIBUTIONS': '지원되는 에어드롭 배포', 'Still waiting on-chain': '온체인에서 대기 중',
    'Airdrop distributions': '에어드롭 배포', 'Distribution': '배포', 'Allocation state': '할당 상태',
    'Reference value': '참조 가치', 'Priced subtotal': '가격 확인 부분 합계', 'Price unavailable': '가격을 사용할 수 없음',
    'No current prices': '현재 가격 없음', 'Excludes {tokens}': '{tokens} 제외', 'Unlocked': '잠금 해제', 'Locked': '잠김',
    'Support this free tool': '무료 도구 지원', 'Found this useful? Support its upkeep:': '유용했나요? 유지 관리를 지원하세요:',
    'Claimed': '수령 완료', 'Unclaimed': '미수령', 'Empty': '없음', 'Unverified': '검증 안 됨',
  }),
  fr: merge({
    'Language': 'Langue', 'READ-ONLY SCANNER': 'ANALYSEUR EN LECTURE SEULE', 'Unclaimed on Sui': 'Airdrops non réclamés sur Sui',
    'Addresses or SuiNS names': 'Adresses ou noms SuiNS', 'Scan addresses': 'Analyser les adresses', 'Scan results': 'Résultats',
    'All distributions': 'Toutes les distributions', 'Browse addresses': 'Voir les adresses', 'Airdrop overview': 'Vue des airdrops',
    'SUPPORTED AIRDROP DISTRIBUTIONS': 'DISTRIBUTIONS D’AIRDROPS PRISES EN CHARGE', 'Still waiting on-chain': 'Toujours en attente on-chain',
    'Airdrop distributions': 'Distributions', 'Distribution': 'Distribution', 'Allocation state': 'État de l’allocation',
    'Reference value': 'Valeur indicative', 'Priced subtotal': 'Sous-total valorisé', 'Price unavailable': 'Prix indisponible',
    'No current prices': 'Aucun prix actuel', 'Excludes {tokens}': 'Hors {tokens}', 'Unlocked': 'Débloqué', 'Locked': 'Verrouillé',
    'Support this free tool': 'Soutenir cet outil gratuit', 'Found this useful? Support its upkeep:': 'Utile ? Soutenez son maintien :',
    'Claimed': 'Réclamé', 'Unclaimed': 'Non réclamé', 'Empty': 'Vide', 'Unverified': 'Non vérifié',
  }),
  uk: merge({
    'Language': 'Мова', 'READ-ONLY SCANNER': 'СКАНЕР ЛИШЕ ДЛЯ ЧИТАННЯ', 'Unclaimed on Sui': 'Незатребувані аірдропи в Sui',
    'Addresses or SuiNS names': 'Адреси або імена SuiNS', 'Scan addresses': 'Перевірити адреси', 'Scan results': 'Результати перевірки',
    'All distributions': 'Усі розподіли', 'Browse addresses': 'Переглянути адреси', 'Airdrop overview': 'Огляд аірдропів',
    'SUPPORTED AIRDROP DISTRIBUTIONS': 'ПІДТРИМУВАНІ РОЗПОДІЛИ АІРДРОПІВ', 'Still waiting on-chain': 'Ще очікують у мережі',
    'Airdrop distributions': 'Розподіли аірдропів', 'Distribution': 'Розподіл', 'Allocation state': 'Стан розподілу',
    'Reference value': 'Орієнтовна вартість', 'Priced subtotal': 'Проміжна оцінка', 'Price unavailable': 'Ціна недоступна',
    'No current prices': 'Немає актуальних цін', 'Excludes {tokens}': 'Без {tokens}', 'Unlocked': 'Розблоковано', 'Locked': 'Заблоковано',
    'Support this free tool': 'Підтримати безкоштовний інструмент', 'Found this useful? Support its upkeep:': 'Корисно? Підтримайте його роботу:',
    'Claimed': 'Отримано', 'Unclaimed': 'Не отримано', 'Empty': 'Порожньо', 'Unverified': 'Не перевірено',
  }),
};

export function detectLocale(languages = []) {
  for (const item of languages) {
    const value = String(item).toLowerCase();
    if (value.startsWith('zh-hant') || /zh-(tw|hk|mo)/.test(value)) return 'zh-TW';
    if (value.startsWith('zh')) return 'zh-CN';
    const base = value.split('-')[0];
    if (LOCALES.some(([code]) => code === base)) return base;
  }
  return 'en';
}

export function translate(locale, source, variables = {}) {
  const value = DICTIONARIES[locale]?.[source] || en[source] || source;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(variables[key] ?? `{${key}}`));
}

export function formatUtc(value, locale = 'en') {
  if (!value || Number.isNaN(new Date(value).getTime())) return '--';
  return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC', hour12: false }).format(new Date(value))} UTC`;
}
