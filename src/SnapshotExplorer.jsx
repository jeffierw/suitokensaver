import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Copy, Check, RefreshCw, LoaderCircle, X } from 'lucide-react';
import { CAMPAIGNS, UNKNOWN_WAL } from '../shared/campaigns.mjs';
import { formatAmount } from '../shared/validation.mjs';
import { quoteValue } from '../snapshots/prices.mjs';

const campaigns = [...CAMPAIGNS, UNKNOWN_WAL];
const symbols = ['WAL', 'DEEP', 'NS'];
const decimals = { WAL: 9, DEEP: 6, NS: 6 };
const short = (address) => `${address.slice(0, 10)}...${address.slice(-8)}`;
const time = (value) => new Date(value).toLocaleString();
const money = (cents) => cents == null ? 'Unavailable' : `$${formatAmount(cents, 2)}`;
const statusNames = { claimed: 'Claimed', claimable: 'Unclaimed', locked: 'Locked', empty: 'Empty', unverifiable: 'Unverified' };
async function read(route, params, signal) {
  const response = await fetch(`/api/snapshots/${route}?${new URLSearchParams(params || {})}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Snapshot unavailable.');
  return data;
}

function AllocationEvidence({ params }) {
  const [state, setState] = useState({ loading: true });
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    read('evidence', { ...params, page }, controller.signal).then((data) => setState({ data })).catch((error) => {
      if (!controller.signal.aborted) setState({ error: error.message });
    });
    return () => controller.abort();
  }, [params.id, params.token, params.round, params.status, params.address, page]);
  return <div className="snapshot-evidence">
    {state.loading && <p>Loading object evidence...</p>}
    {state.error && <p className="warning">{state.error}</p>}
    {state.data?.items.map((item) => <div className="allocation" key={item.objectId}>
      <span>{campaigns.find((entry) => entry.id === item.campaignId)?.round || item.campaignId}</span>
      <strong>{formatAmount(item.amount, item.decimals)} {item.symbol}</strong>
      <a href={`https://suiscan.xyz/mainnet/object/${item.objectId}`} target="_blank" rel="noreferrer">NFT / wrapper: {short(item.objectId)} <ArrowUpRight size={12} /></a>
      {item.fundingId && <a href={`https://suiscan.xyz/mainnet/object/${item.fundingId}`} target="_blank" rel="noreferrer">Funding: {short(item.fundingId)} <ArrowUpRight size={12} /></a>}
      {item.recoveryAvailable && <p className="warning">Administrator recovery is available; funds were still present at this checkpoint.</p>}
    </div>)}
    {state.data && <div className="actions"><button type="button" className="icon-button" aria-label="Previous evidence page" disabled={page === 1} onClick={() => setPage(page - 1)}><ArrowLeft size={14} /></button><span>Evidence page {page}</span><button type="button" className="icon-button" aria-label="Next evidence page" disabled={!state.data.hasMore} onClick={() => setPage(page + 1)}><ArrowRight size={14} /></button></div>}
  </div>;
}

function HolderRow({ row, params, quote, now, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  const [copy, setCopy] = useState('Copy address');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyAddress() {
    try { await navigator.clipboard.writeText(row.address); setCopy('Copied'); }
    catch { setCopy('Copy failed'); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy('Copy address'), 1600);
  }
  return <div className="holder">
    <div className="holder-grid">
      <div className="holder-address"><a href={`https://suiscan.xyz/mainnet/account/${row.address}`} title={row.address} target="_blank" rel="noreferrer">{short(row.address)}</a><button type="button" className="icon-button" title={copy} aria-label={copy} onClick={copyAddress}>{copy === 'Copied' ? <Check size={14} /> : <Copy size={14} />}</button></div>
      <div className="holder-amount"><strong>{formatAmount(row.amount, decimals[params.token])} {params.token}</strong>{row.recovery > 0 && <span className="warning">Recovery available</span>}</div>
      <span className="holder-usd">{money(quoteValue(row.amount, decimals[params.token], quote, now))}</span>
      <span className="holder-count">{row.allocations} <span className="mobile-label">allocations</span></span>
      <div className="actions holder-actions"><button type="button" className="icon-button" title="Verify address on-chain" aria-label="Verify address on-chain" onClick={() => onVerify(row.address)}><RefreshCw size={15} /></button><button type="button" className="icon-button" title="Object evidence" aria-label="Object evidence" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>
    </div>
    {expanded && <AllocationEvidence params={{ ...params, address: row.address }} />}
  </div>;
}

function LiveResult({ state, close }) {
  if (!state) return null;
  return <section className="snapshot-live" aria-label="Live verification result">
    <div className="results-heading"><div><h3>Live verification</h3><p className="small muted">{short(state.address)}{state.data && ` / ${time(state.data.checkedAt)}`}</p></div><button type="button" className="icon-button" aria-label="Close live verification" onClick={close}><X size={16} /></button></div>
    {state.loading && <p><LoaderCircle size={15} className="spin" /> Reading mainnet...</p>}
    {state.error && <p className="warning" role="alert">{state.error}</p>}
    {state.data?.groups.map((group) => {
      const campaign = campaigns.find((entry) => entry.id === group.campaignId);
      return <div className="live-group" key={group.campaignId}><strong>{campaign?.name} / {campaign?.round}</strong>
        {group.items.map((item, index) => <div className="live-item" key={item.objectId || index}><span>{statusNames[item.status]}</span><span>{item.amount == null ? '--' : `${formatAmount(item.amount, campaign.decimals)} ${campaign.symbol}`}</span></div>)}
        {!group.items.length && <p className="muted">{group.complete ? 'No matching object currently held.' : 'Incomplete verification.'}</p>}
        {group.errors.map((error, index) => <p className="warning" key={index}>{error}</p>)}
      </div>;
    })}
  </section>;
}

export default function SnapshotExplorer() {
  const [manifest, setManifest] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [token, setToken] = useState('WAL');
  const [round, setRound] = useState('all');
  const [status, setStatus] = useState('claimable');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ loading: true });
  const [now, setNow] = useState(Date.now());
  const [live, setLive] = useState(null);
  const liveController = useRef();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { clearInterval(timer); liveController.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setManifest(null);
    setQuotes(null);
    setPage(1);
    read('latest', {}, controller.signal).then(setManifest).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    read('prices', {}, controller.signal).then(setQuotes).catch(() => {});
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    setList({ loading: true });
    read('page', { id: manifest.id, token, round, status, page }, controller.signal).then((data) => setList({ data })).catch((reason) => {
      if (!controller.signal.aborted) setList({ error: reason.message });
    });
    return () => controller.abort();
  }, [manifest, token, round, status, page]);
  async function verify(address) {
    liveController.current?.abort();
    const controller = new AbortController();
    liveController.current = controller;
    setLive({ address, loading: true });
    try {
      const response = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Live verification failed.');
      if (!controller.signal.aborted) setLive({ address, data });
    } catch (reason) { if (!controller.signal.aborted) setLive({ address, error: reason.message }); }
  }
  const values = symbols.map((symbol) => manifest && quoteValue(manifest.scopes[`${symbol}/all/claimable`]?.amount || '0', decimals[symbol], quotes?.quotes?.[symbol], now));
  const totalUsd = manifest && values.every((value) => value != null) ? values.reduce((sum, value) => sum + BigInt(value), 0n).toString() : null;
  const scope = `${token}/${round}/${status}`;
  const summary = manifest?.scopes[scope];
  return <section className="snapshot-explorer" aria-label="Global airdrop snapshot">
    <div className="results-heading"><div><span className="eyebrow">SUPPORTED AIRDROP DISTRIBUTIONS</span><h2>Still waiting on-chain</h2></div><button type="button" className="icon-button" title="Refresh snapshot" aria-label="Refresh snapshot" onClick={() => setRevision(revision + 1)}><RefreshCw size={17} /></button></div>
    {error && <p className="snapshot-unavailable">{error}</p>}
    {!manifest && !error && <p className="muted">Loading global snapshot...</p>}
    {manifest && <>
      <div className="snapshot-stats"><div><span>{manifest.complete ? 'Unclaimed estimate' : 'Verified subtotal estimate'}</span><strong>{totalUsd == null ? 'Price unavailable' : `≈ ${money(totalUsd)}`}</strong></div><div><span>Holder addresses</span><strong>{manifest.holders.toLocaleString()}</strong></div><div><span>Unclaimed allocations</span><strong>{manifest.allocations.toLocaleString()}</strong></div></div>
      <p className="snapshot-timestamp">Chain snapshot: {time(manifest.checkpoint.timestamp)} / Checkpoint {manifest.checkpoint.sequenceNumber}{now - Date.parse(manifest.checkpoint.timestamp) > 7 * 3600000 && <span className="warning"> / Snapshot overdue</span>}</p>
      <p className="snapshot-timestamp">{quotes?.quotes?.[token] ? `Price: ${time(quotes.quotes[token].updatedAt)} / ${quotes.quotes[token].source}` : 'Price unavailable'} / Known distributions only</p>
      {!manifest.complete && <p className="warning">{manifest.unresolved} records could not be verified. Figures exclude unresolved allocations and are not complete totals.</p>}
      <div className="snapshot-controls"><div className="token-tabs" role="tablist" aria-label="Airdrop token">{symbols.map((symbol) => <button type="button" role="tab" aria-selected={token === symbol} key={symbol} onClick={() => { setToken(symbol); setRound('all'); setPage(1); }}>{symbol}</button>)}</div><div className="snapshot-selects"><label>Round<select value={round} onChange={(event) => { setRound(event.target.value); setPage(1); }}><option value="all">All rounds</option>{campaigns.filter((entry) => entry.symbol === token).map((entry) => <option value={entry.id} key={entry.id}>{entry.round}</option>)}</select></label><label>Allocation state<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="claimable">Unlocked</option><option value="locked">Locked</option></select></label></div></div>
      <div className="scope-summary"><span>{summary ? `${summary.holders.toLocaleString()} addresses` : 'No summary'}</span><span>{summary ? `${formatAmount(summary.amount, decimals[token])} ${token} in this category` : ''}</span></div>
      <div className="holder-grid holder-head"><span>Address</span><span>Unclaimed amount</span><span>Estimate / USD</span><span>Allocations</span><span /></div>
      {list.loading && <p className="muted snapshot-loading" role="status">Loading addresses...</p>}
      {list.error && <p className="warning" role="alert">{list.error}</p>}
      {list.data?.rows.map((row) => <HolderRow key={`${manifest.id}-${scope}-${page}-${row.address}`} row={row} params={{ id: manifest.id, token, round, status }} quote={quotes?.quotes?.[token]} now={now} onVerify={verify} />)}
      {list.data?.rows.length === 0 && <p className="muted snapshot-loading">No verified allocations in this category at this checkpoint.</p>}
      <div className="snapshot-pagination"><span>Page {page} of {summary?.pages || 1}</span><div className="actions"><button type="button" className="icon-button" title="Previous page" aria-label="Previous page" disabled={list.loading || page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={17} /></button><button type="button" className="icon-button" title="Next page" aria-label="Next page" disabled={list.loading || page >= (summary?.pages || 1)} onClick={() => setPage(page + 1)}><ArrowRight size={17} /></button></div></div>
      <LiveResult state={live} close={() => { liveController.current?.abort(); setLive(null); }} />
      <p className="disclaimer">Snapshot amounts are historical, not a guarantee of current redemption. An administrator may recover some allocations. WAL round labels use creation history; unclassified WAL remains included in the token total.</p>
    </>}
  </section>;
}
