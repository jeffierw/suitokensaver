import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Copy, Check, RefreshCw } from 'lucide-react';
import { CAMPAIGNS, UNKNOWN_WAL } from '../shared/campaigns.mjs';
import { formatAmount } from '../shared/validation.mjs';
import { quoteValue as strictQuoteValue, QUOTE_MAX_AGE } from '../snapshots/prices.mjs';
import { useI18n } from './i18n.jsx';

const campaigns = [...CAMPAIGNS, UNKNOWN_WAL];
const symbols = ['WAL', 'DEEP', 'NS'];
const decimals = { WAL: 9, DEEP: 6, NS: 6 };
const quoteValue = (amount, decimals, quote, now) => strictQuoteValue(amount, decimals, quote, now, true);
const short = (value) => `${value.slice(0, 10)}...${value.slice(-8)}`;
const money = (value) => value == null ? '--' : `$${formatAmount(value, 2)}`;
async function read(route, params, signal) {
  const response = await fetch(`/api/snapshots/${route}?${new URLSearchParams(params || {})}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Snapshot unavailable.');
  return data;
}
function useSelection() {
  const [selection, setSelection] = useState({ token: 'WAL', round: 'all', status: 'claimable' });
  useEffect(() => {
    const receive = (event) => setSelection(event.detail);
    window.addEventListener('suitokensaver:snapshot-selection', receive);
    return () => window.removeEventListener('suitokensaver:snapshot-selection', receive);
  }, []);
  const update = (next) => {
    const value = { ...selection, ...next };
    setSelection(value);
    window.dispatchEvent(new CustomEvent('suitokensaver:snapshot-selection', { detail: value }));
  };
  return [selection, update];
}
function useSnapshot() {
  const [state, setState] = useState({ manifest: null, quotes: null, error: null, revision: 0 });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([read('latest', {}, controller.signal), read('prices', {}, controller.signal)])
      .then(([manifest, quotes]) => setState((current) => ({ ...current, manifest, quotes, error: null })))
      .catch((error) => { if (!controller.signal.aborted) setState((current) => ({ ...current, error: error.message })); });
    return () => controller.abort();
  }, [state.revision]);
  useEffect(() => {
    const refresh = () => setState((current) => ({ ...current, revision: current.revision + 1 }));
    const visibility = () => { if (!document.hidden) refresh(); };
    const interval = setInterval(refresh, 60 * 1000);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return { ...state, refresh: () => setState((current) => ({ ...current, revision: current.revision + 1 })) };
}
function Controls({ selection, update, compact = false }) {
  const { t } = useI18n();
  return <div className={`snapshot-controls ${compact ? 'compact' : ''}`}>
    <div className="token-tabs" role="tablist" aria-label={t('Airdrop distributions')}>{symbols.map((symbol) => <button type="button" role="tab" aria-selected={selection.token === symbol} key={symbol} onClick={() => update({ token: symbol, round: 'all' })}>{symbol}</button>)}</div>
    <div className="round-tabs" aria-label={t('Distribution')}><button type="button" className={selection.round === 'all' ? 'selected' : ''} onClick={() => update({ round: 'all' })}>{t('All rounds')}</button>{campaigns.filter((entry) => entry.symbol === selection.token && entry.id !== 'wal-unknown').map((entry) => <button type="button" className={selection.round === entry.id ? 'selected' : ''} onClick={() => update({ round: entry.id })} key={entry.id}>{t(entry.round)}</button>)}</div>
    {!compact && <div className="segmented" aria-label={t('Allocation state')}><button type="button" className={selection.status === 'claimable' ? 'selected' : ''} onClick={() => update({ status: 'claimable' })}>{t('Unlocked')}</button><button type="button" className={selection.status === 'locked' ? 'selected' : ''} onClick={() => update({ status: 'locked' })}>{t('Locked')}</button></div>}
  </div>;
}
function Overview() {
  const { t, time } = useI18n();
  const { manifest, quotes, error, refresh } = useSnapshot();
  const [selection, update] = useSelection();
  const values = symbols.map((symbol) => quoteValue(manifest?.scopes?.[`${symbol}/all/claimable`]?.amount || '0', decimals[symbol], quotes?.quotes?.[symbol], Date.now()));
  const subtotal = values.reduce((total, value) => value == null ? total : total + BigInt(value), 0n);
  const missing = symbols.filter((_, index) => values[index] == null);
  return <section className="snapshot-overview" aria-label={t('Airdrop overview')}>
    <div className="results-heading"><div><span className="eyebrow">{t('SUPPORTED AIRDROP DISTRIBUTIONS')}</span><h1>{t('Still waiting on-chain')}</h1></div><button type="button" className="icon-button" title={t('Refresh snapshot')} aria-label={t('Refresh snapshot')} onClick={refresh}><RefreshCw size={17} /></button></div>
    {error && <p className="snapshot-unavailable">{t(error)}</p>}
    {!manifest && !error && <p className="muted">{t('Loading global snapshot...')}</p>}
    {manifest && <><div className="snapshot-stats"><div><span>{missing.length ? t('Priced subtotal') : t('Reference value')}</span><strong>{subtotal ? `≈ ${money(subtotal.toString())}` : t('No current prices')}</strong>{missing.length > 0 && <small>{t('Excludes {tokens}', { tokens: missing.join(', ') })}</small>}</div><div><span>{t('Holder addresses')}</span><strong>{manifest.holders.toLocaleString()}</strong></div><div><span>{t('Unclaimed allocations')}</span><strong>{manifest.allocations.toLocaleString()}</strong></div></div>
      <p className="snapshot-timestamp">{t('Chain snapshot: {time} / Checkpoint {checkpoint}', { time: time(manifest.checkpoint.timestamp), checkpoint: manifest.checkpoint.sequenceNumber })}</p>
      <p className="snapshot-timestamp">{t('Updated daily after 02:00 UTC. Completed: {time}', { time: time(manifest.completedAt) })}</p>
      <p className="snapshot-timestamp">{quotes?.quotes?.[selection.token] ? t('Price: {time} / {source}', { time: time(quotes.quotes[selection.token].updatedAt), source: quotes.quotes[selection.token].source }) : t('Price unavailable')}</p>
      <Controls selection={selection} update={update} />
      {symbols.some((symbol) => quotes?.quotes?.[symbol] && Date.now() - quotes.quotes[symbol].updatedAt > QUOTE_MAX_AGE) && <p className="warning">{t('Estimates include expired prices. Check price timestamps before use.')}</p>}
      {quotes?.quotes?.[selection.token]?.reference && <p className="quote-note">{t('USDC reference; assumes 1 USDC = 1 USD. Not expected sale proceeds.')}</p>}
      <a className="browse-link" href="#airdrop-addresses">{t('Browse addresses')} <ArrowUpRight size={14} /></a>
    </>}
  </section>;
}
function HolderRow({ row, params, quote }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [copy, setCopy] = useState('Copy address');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyAddress() { try { await navigator.clipboard.writeText(row.address); setCopy('Copied'); } catch { setCopy('Copy failed'); } clearTimeout(timer.current); timer.current = setTimeout(() => setCopy('Copy address'), 1600); }
  return <div className="holder"><div className="holder-grid"><div className="holder-address"><a href={`https://suiscan.xyz/mainnet/account/${row.address}`} target="_blank" rel="noreferrer">{short(row.address)}</a><button type="button" className="icon-button" title={t(copy)} aria-label={t(copy)} onClick={copyAddress}>{copy === 'Copied' ? <Check size={14} /> : <Copy size={14} />}</button></div><div className="holder-amount"><strong>{formatAmount(row.amount, decimals[params.token])} {params.token}</strong>{row.recovery > 0 && <span className="warning">{t("Recovery available")}</span>}</div><span className="holder-usd">{money(quoteValue(row.amount, decimals[params.token], quote, Date.now()))}</span><span className="holder-count">{row.allocations}</span><button type="button" className="icon-button" title={t('Object evidence')} aria-label={t('Object evidence')} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>{expanded && <Evidence params={{ ...params, address: row.address }} />}</div>;
}
function Evidence({ params }) {
  const { t } = useI18n();
  const [state, setState] = useState({ loading: true });
  useEffect(() => { const controller = new AbortController(); read('evidence', { ...params, page: 1 }, controller.signal).then((data) => setState({ data })).catch((error) => { if (!controller.signal.aborted) setState({ error: error.message }); }); return () => controller.abort(); }, [params.id, params.token, params.round, params.status, params.address]);
  return <div className="snapshot-evidence">{state.loading && <p>{t('Loading addresses...')}</p>}{state.error && <p className="warning">{t(state.error)}</p>}{state.data?.items.map((item) => <div className="allocation" key={item.objectId}><span>{t(campaigns.find((entry) => entry.id === item.campaignId)?.round || item.campaignId)}</span><strong>{formatAmount(item.amount, item.decimals)} {item.symbol}</strong><a href={`https://suiscan.xyz/mainnet/object/${item.objectId}`} target="_blank" rel="noreferrer">{t("NFT / wrapper")}: {short(item.objectId)} <ArrowUpRight size={12} /></a></div>)}</div>;
}
function Details() {
  const { t } = useI18n();
  const { manifest, quotes, error } = useSnapshot();
  const [selection, update] = useSelection();
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ loading: true });
  useEffect(() => setPage(1), [selection.token, selection.round, selection.status]);
  useEffect(() => { if (!manifest) return; const controller = new AbortController(); setList({ loading: true }); read('page', { id: manifest.id, ...selection, page }, controller.signal).then((data) => setList({ data })).catch((reason) => { if (!controller.signal.aborted) setList({ error: reason.message }); }); return () => controller.abort(); }, [manifest, selection, page]);
  const summary = manifest?.scopes?.[`${selection.token}/${selection.round}/${selection.status}`];
  return <section className="snapshot-explorer" id="airdrop-addresses" aria-label={t('Browse addresses')}><div className="results-heading"><div><span className="eyebrow">{t('Airdrop distributions')}</span><h2>{t('Browse addresses')}</h2></div></div>{error && <p className="snapshot-unavailable">{t(error)}</p>}{manifest && <><Controls selection={selection} update={update} compact /><div className="scope-summary"><span>{summary ? t('{count} addresses', { count: summary.holders.toLocaleString() }) : ''}</span><span>{summary ? t('{amount} {token} in this category', { amount: formatAmount(summary.amount, decimals[selection.token]), token: selection.token }) : ''}</span></div><div className="holder-grid holder-head"><span>{t("Address")}</span><span>{t('Unclaimed amount')}</span><span>{t('Estimate / USD')}</span><span>{t('Allocations')}</span><span /></div>{list.loading && <p className="muted snapshot-loading">{t('Loading addresses...')}</p>}{list.error && <p className="warning">{t(list.error)}</p>}{list.data?.rows.map((row) => <HolderRow key={row.address} row={row} params={{ id: manifest.id, ...selection }} quote={quotes?.quotes?.[selection.token]} />)}<div className="snapshot-pagination"><span>{t('Page {page} of {pages}', { page, pages: summary?.pages || 1 })}</span><div className="actions"><button type="button" className="icon-button" title={t('Previous page')} aria-label={t('Previous page')} disabled={list.loading || page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={17} /></button><button type="button" className="icon-button" title={t('Next page')} aria-label={t('Next page')} disabled={list.loading || page >= (summary?.pages || 1)} onClick={() => setPage(page + 1)}><ArrowRight size={17} /></button></div></div></>}</section>;
}
export default function SnapshotExplorer({ variant = 'details' }) { return variant === 'overview' ? <Overview /> : <Details />; }
