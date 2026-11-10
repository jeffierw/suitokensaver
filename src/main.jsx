import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Search, LoaderCircle, ShieldCheck, Download, RotateCw, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { CAMPAIGNS, UNKNOWN_WAL } from '../shared/campaigns.mjs';
import { parseInputs, formatAmount } from '../shared/validation.mjs';
import { scanBatch } from './batch.mjs';
import logo from '../design/stitch/01-favicon-logo/logo.svg';
import './style.css';
import SnapshotExplorer from './SnapshotExplorer.jsx';

const STATUS = { claimable: 'Unclaimed', claimed: 'Claimed', locked: 'Locked', empty: 'Empty', unverifiable: 'Unverified' };
const short = (value) => value?.length > 24 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
const date = (value) => new Date(value).toLocaleString();
const explorer = (kind, value) => `https://suiscan.xyz/mainnet/${kind}/${encodeURIComponent(value)}`;

async function post(route, body, signal) {
  const response = await fetch(`/api/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Query failed. Please retry.');
  return data;
}

function CopyButton({ value }) {
  const [state, setState] = useState('Copy address');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState('Copied'); }
    catch { setState('Copy failed'); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('Copy address'), 1800);
  }
  return <button className="icon-button" type="button" title={state} aria-label={state} onClick={copy}>{state === 'Copied' ? <Check size={14} /> : <Copy size={14} />}</button>;
}

function EvidenceLink({ label, value, kind = 'object' }) {
  if (!value) return null;
  return <div className="evidence-line"><span>{label}</span><a href={explorer(kind, value)} target="_blank" rel="noreferrer">{value}<ArrowUpRight size={12} /></a></div>;
}

function ResultRow({ result, item, campaign, group }) {
  return <div className="result-row">
    <div className="result-main">
      <div className="account"><strong title={result.inputs.join(', ')}>{result.inputs.map(short).join(', ')}</strong>
        <div className="muted address"><a href={explorer('account', result.address)} title={result.address} target="_blank" rel="noreferrer">{short(result.address)}</a><CopyButton value={result.address} /></div>
      </div>
      <span className={`status ${item?.status || (group.complete ? 'absent' : 'unverifiable')}`}>{item ? STATUS[item.status] : group.complete ? 'No object found' : 'Incomplete'}</span>
      <strong className="amount">{item?.amount != null ? `${formatAmount(item.amount, campaign.decimals)} ${campaign.symbol}` : '--'}</strong>
    </div>
    {item ? <details><summary>On-chain evidence</summary>
      <div className="evidence">
        <p>{item.reason}</p>
        {item.classificationWarning && <p className="warning">{item.classificationWarning}</p>}
        <EvidenceLink label="NFT / receipt" value={item.objectId} />
        <EvidenceLink label="Funding object" value={item.lockedId} />
        <EvidenceLink label="Configuration" value={item.configId} />
        <EvidenceLink label="Creation transaction" value={item.creation?.digest} kind="tx" />
        {item.creation && <p>Created: {date(item.creation.timestamp)}. WAL round is classified by creation date.</p>}
        {item.unlockAt != null && <p>Unlocked: {date(item.unlockAt)}</p>}
        {item.recoveryAt != null && <p className={item.recoveryAvailable ? 'warning' : ''}>Administrator recovery available: {date(item.recoveryAt)}. This is not an automatic expiry.</p>}
        <p>Checkpoint {result.checkpoint} at {date(result.checkpointTime)}</p>
        <p>Read at {date(result.checkedAt)} via {result.source}. Reads are not an atomic snapshot.</p>
        <p className="type">{item.type}</p>
      </div>
    </details> : <p className="empty-note">{group.complete ? 'No matching NFT or receipt currently held. This does not establish past eligibility or claim history.' : 'This distribution could not be fully checked. Retry before drawing a conclusion.'}</p>}
  </div>;
}

function App() {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [filter, setFilter] = useState('all');
  const controller = useRef();
  useEffect(() => () => controller.current?.abort(), []);
  const parsed = parseInputs(text);
  const invalid = parsed.error || parsed.invalid.length > 0;
  const campaigns = [...CAMPAIGNS, UNKNOWN_WAL].filter((campaign) => campaign.id !== 'wal-unknown' || batch?.results.some((result) => result.groups.some((group) => group.campaignId === campaign.id)));
  async function run(event) {
    event?.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setBatch(null);
    setProgress(null);
    setFilter('all');
    try {
      const data = await scanBatch(parsed.valid.map((entry) => entry.input), {
        signal: current.signal,
        resolve: (input, signal) => post('resolve', { input }, signal),
        scan: (address, signal) => post('scan', { address }, signal),
        onProgress: (value) => { if (controller.current === current) setProgress(value); },
      });
      if (controller.current === current) setBatch(data);
    } catch (error) {
      if (!current.signal.aborted) setBatch({ results: [], errors: [{ inputs: [], error: error.message }] });
    } finally {
      if (controller.current === current) setBusy(false);
    }
  }
  function cancel() { controller.current?.abort(); setBusy(false); setProgress(null); }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `suitokensaver-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <header className="header"><a className="brand" href="/"><img src={logo} alt="" width="36" height="36" /><span>suitokensaver</span></a><span className="network"><span />Sui Mainnet</span></header>
    <main>
      <section className="query-section">
        <div className="eyebrow"><ShieldCheck size={14} /> READ-ONLY SCANNER</div>
        <h1>Unclaimed on Sui</h1>
        <div className="intro-copy">
          <p className="intro-lead">An old wallet may still have something waiting.</p>
          <p>Airdrop announcements come and go. Wallets get forgotten. But an unclaimed WAL, DEEP or NS allocation may still be there, even if you missed the original claim window.</p>
        </div>
        <div className="supported">{['WAL', 'DEEP', 'NS'].map((symbol) => <span key={symbol} className={`token-label ${symbol.toLowerCase()}`}>{symbol}</span>)}<span className="muted">5 distributions</span></div>
        <form onSubmit={run} noValidate>
          <div className="field-heading"><label htmlFor="addresses">Addresses or SuiNS names</label><span className="muted">{parsed.valid.length} / 20</span></div>
          <textarea id="addresses" value={text} onChange={(event) => setText(event.target.value)} spellCheck="false" autoCapitalize="none" autoComplete="off" placeholder={'0x...\nname.sui\n@name'} aria-invalid={submitted && !!invalid} aria-describedby={submitted && invalid ? 'input-error' : undefined} maxLength={12000} />
          {submitted && invalid && <div id="input-error" className="validation" role="alert">{parsed.error && <p>{parsed.error}</p>}{parsed.invalid.map((entry, index) => <p key={index}><strong>{entry.input}</strong>: {entry.error}</p>)}</div>}
          <div className="form-bottom"><span className="muted small">{parsed.duplicates ? `${parsed.duplicates} duplicate input(s) removed` : 'No wallet connection or signature'}</span>
            <div className="actions">{busy && <button type="button" className="icon-button" aria-label="Cancel scan" title="Cancel scan" onClick={cancel}><X size={18} /></button>}
              <button type="submit" className="primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />}{busy ? 'Scanning' : 'Scan addresses'}</button>
            </div>
          </div>
        </form>
      </section>
      <div role="status" aria-live="polite">{busy && <div className="loading"><LoaderCircle className="spin" size={18} />{progress ? `${progress.done} of ${progress.total} addresses checked` : 'Resolving addresses'}</div>}</div>
      {batch && <section className="results" aria-label="Scan results">
        <div className="results-heading"><div><h2>Scan results</h2><p className="muted small">{batch.results.length} addresses checked{batch.errors.length ? ` / ${batch.errors.length} failed` : ''}</p></div>
          <div className="actions"><button className="icon-button" title="Rescan current input" aria-label="Rescan current input" onClick={run}><RotateCw size={18} /></button><button className="icon-button" title="Export JSON" aria-label="Export JSON" onClick={download}><Download size={18} /></button></div>
        </div>
        {batch.errors.map((entry, index) => <div className="error-banner" role="alert" key={index}><AlertTriangle size={16} /><div><strong>{entry.inputs.map(short).join(', ') || 'Scan failed'}</strong><p>{entry.error}</p></div></div>)}
        {batch.results.length > 0 && <>
          <div className="filter-bar"><label htmlFor="status-filter">Status</label><select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="muted small">Amounts are in tokens, not USD</span></div>
          {campaigns.map((campaign) => <section className="campaign" key={campaign.id}>
            <div className="campaign-heading"><div className={`token-mark ${campaign.color}`}>{campaign.symbol === 'DEEP' ? 'D' : campaign.symbol === 'WAL' ? 'W' : '@'}</div><div className="campaign-title"><h3>{campaign.name} <span>{campaign.round}</span></h3><p className="muted small">{campaign.date}</p></div>{campaign.url && <a className="official" href={campaign.url} target="_blank" rel="noreferrer">Official portal<ArrowUpRight size={14} /></a>}</div>
            {batch.results.map((result) => {
              const group = result.groups.find((entry) => entry.campaignId === campaign.id);
              if (!group) return null;
              const items = group.items.filter((item) => filter === 'all' || item.status === filter);
              return <React.Fragment key={result.address}>
                {group.errors.map((error, index) => <p className="group-error" key={index}>{short(result.address)}: {error}</p>)}
                {items.map((item) => <ResultRow key={item.objectId} {...{ result, item, campaign, group }} />)}
                {group.items.length === 0 && filter === 'all' && <ResultRow {...{ result, campaign, group }} />}
              </React.Fragment>;
            })}
            {filter !== 'all' && !batch.results.some((result) => result.groups.some((group) => group.campaignId === campaign.id && group.items.some((item) => item.status === filter))) && <p className="no-match">No matching results in this filter.</p>}
          </section>)}
          <p className="disclaimer">Unclaimed means the required on-chain objects were found at query time, not a guarantee of successful redemption. Claimed amounts are historical receipt amounts, not current wallet balances.</p>
        </>}
      </section>}
      {!batch && !busy && <section className="airdrop-context" aria-labelledby="airdrop-context-title">
        <div className="context-heading"><span className="eyebrow">WORTH A SECOND LOOK</span><h2 id="airdrop-context-title">Missed the announcement,<br />not necessarily the airdrop.</h2></div>
        <div className="context-copy">
          <p>On Sui, some airdrop allocations live in NFTs or token-holding objects, separate from the coins shown in a wallet balance. An account that looks empty can still hold an unredeemed allocation.</p>
          <details><summary>Does a closed claim page mean the tokens are gone?</summary><p>Not necessarily. A website's claim window and the contract's withdrawal rules can differ. The current contract state and remaining funds matter; some distributions also allow an administrator to recover unclaimed tokens.</p></details>
          <details><summary>Is an airdrop NFT proof that I can claim?</summary><p>Not by itself. An NFT may be a receipt for an earlier claim, have no matching funds left, or be an imitation. Its exact contract type, withdrawal state and funding object all matter.</p></details>
        </div>
      </section>}
      <SnapshotExplorer />
    </main>
    <footer><span>suitokensaver</span><span>Read-only / Mainnet</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
