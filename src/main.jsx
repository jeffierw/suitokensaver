import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Search, LoaderCircle, ShieldCheck, Download, RotateCw, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { CAMPAIGNS, UNKNOWN_WAL } from '../shared/campaigns.mjs';
import { parseInputs, formatAmount } from '../shared/validation.mjs';
import { scanBatch } from './batch.mjs';
import logo from '../design/stitch/01-favicon-logo/logo.svg';
import './style.css';
import SnapshotExplorer from './SnapshotExplorer.jsx';
import { LocaleProvider, useI18n } from './i18n.jsx';
import { LOCALES } from './locales.mjs';
import SelectMenu from './SelectMenu.jsx';
import { claimAction, deepClaimPrompt, visibleCampaigns } from './claims.mjs';

const STATUS = { claimable: 'Unclaimed', claimed: 'Claimed', locked: 'Locked', empty: 'Empty', unverifiable: 'Unverified' };
const short = (value) => value?.length > 24 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
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

function CopyButton({ value, label = 'Copy address', text = false }) {
  const { t } = useI18n();
  const [state, setState] = useState(label);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState('Copied'); }
    catch { setState('Copy failed'); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(label), 1800);
  }
  return <button className={text ? 'claim-copy' : 'icon-button'} type="button" title={t(state)} aria-label={t(state)} onClick={copy}>{state === 'Copied' ? <Check size={14} /> : <Copy size={14} />}{text && t(state)}</button>;
}

function EvidenceLink({ label, value, kind = 'object' }) {
  const { t } = useI18n();
  if (!value) return null;
  return <div className="evidence-line"><span>{t(label)}</span><a href={explorer(kind, value)} target="_blank" rel="noreferrer">{value}<ArrowUpRight size={12} /></a></div>;
}

function ResultRow({ result, item, campaign, group }) {
  const { time, t, locale, errorText } = useI18n();
  const action = claimAction(item, campaign);
  const deepPrompt = action?.kind === 'agent'
    ? deepClaimPrompt(result, item, campaign, LOCALES.find(([code]) => code === locale)?.[1] || 'English')
    : null;
  return <div className="result-row">
    <div className="result-main">
      <div className="account"><strong title={result.inputs.join(', ')}>{result.inputs.map(short).join(', ')}</strong>
        <div className="muted address"><a href={explorer('account', result.address)} title={result.address} target="_blank" rel="noreferrer">{short(result.address)}</a><CopyButton value={result.address} /></div>
      </div>
      <span className={`status ${item?.status || 'unverifiable'}`}>{t(item ? STATUS[item.status] : 'Incomplete')}</span>
      <strong className="amount">{item?.amount != null ? `${formatAmount(item.amount, campaign.decimals)} ${campaign.symbol}` : '--'}</strong>
    </div>
    {action && <div className="claim-help"><div><strong>{t('How to claim')}</strong><p>{t(action.kind === 'portal' ? 'Open the official portal and connect the wallet holding this allocation. Recheck eligibility before signing.' : 'Copy the prompt to your coding agent to build a local claim site. Review its code and transaction before connecting your wallet.')}</p></div>
      {action.kind === 'portal' ? <a className="claim-link" href={action.url} target="_blank" rel="noopener noreferrer">{t('Open official claim portal')}<ArrowUpRight size={15} /></a>
        : <CopyButton value={deepPrompt} label="Copy DEEP claim prompt" text />}
    </div>}
    {deepPrompt && <details className="deep-prompt" open>
      <summary>{t('DEEP claim-site prompt')}</summary>
      <pre>{deepPrompt}</pre>
    </details>}
    {item && !action && <p className="empty-note">{t('No claim action is available for this state. Recheck the on-chain evidence.')}</p>}
    {item ? <details><summary>{t('On-chain evidence')}</summary>
      <div className="evidence">
        <p>{errorText(item.reason)}</p>
        {item.classificationWarning && <p className="warning">{t('WAL round could not be verified from creation history.')}</p>}
        <EvidenceLink label="NFT / receipt" value={item.objectId} />
        <EvidenceLink label="Funding object" value={item.lockedId} />
        <EvidenceLink label="Configuration" value={item.configId} />
        <EvidenceLink label="Creation transaction" value={item.creation?.digest} kind="tx" />
        {item.creation && <p>{t('Created')}: {time(item.creation.timestamp)}</p>}
        {item.unlockAt != null && <p>{t('Unlocked')}: {time(item.unlockAt)}</p>}
        {item.recoveryAt != null && <p className={item.recoveryAvailable ? 'warning' : ''}>{t('Administrator recovery available')}: {time(item.recoveryAt)}. {t('This is not an automatic expiry.')}</p>}
        <p>{t('Checkpoint')} {result.checkpoint} / {time(result.checkpointTime)}</p>
        <p>{t('Read at')} {time(result.checkedAt)} / {result.source}. {t('Reads are not an atomic snapshot.')}</p>
        <p className="type">{item.type}</p>
      </div>
    </details> : <p className="empty-note">{t('This distribution could not be fully checked. Retry before drawing a conclusion.')}</p>}
  </div>;
}

function App() {
  const { locale, setLocale, t, errorText } = useI18n();
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
  const campaigns = visibleCampaigns([...CAMPAIGNS, UNKNOWN_WAL], batch, filter);
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
    <header className="header"><a className="brand" href="/"><img src={logo} alt="" width="36" height="36" /><span>suitokensaver</span></a><div className="header-tools"><SelectMenu label={t('Language')} value={locale} onChange={setLocale} options={LOCALES} /><span className="network"><span />{t('Sui Mainnet')}</span></div></header>
    <main>
      <SnapshotExplorer variant="overview" />
      <section className="query-section">
        <div className="eyebrow"><ShieldCheck size={14} /> {t('READ-ONLY SCANNER')}</div>
        <h2 className="query-title">{t('Unclaimed on Sui')}</h2>
        <div className="intro-copy">
          <p className="intro-lead">{t('An old wallet may still have something waiting.')}</p>
          <p>{t('Scan your wallets for WAL, DEEP and NS allocations using live on-chain data.')}</p>
        </div>
        <div className="supported">{['WAL', 'DEEP', 'NS'].map((symbol) => <span key={symbol} className={`token-label ${symbol.toLowerCase()}`}>{symbol}</span>)}<span className="muted">{t('5 distributions')}</span></div>
        <form onSubmit={run} noValidate>
          <div className="field-heading"><label htmlFor="addresses">{t('Addresses or SuiNS names')}</label><span className="muted">{parsed.valid.length} / 20</span></div>
          <textarea id="addresses" value={text} onChange={(event) => setText(event.target.value)} spellCheck="false" autoCapitalize="none" autoComplete="off" placeholder={'0x...\nname.sui\n@name'} aria-invalid={submitted && !!invalid} aria-describedby={submitted && invalid ? 'input-error' : undefined} maxLength={12000} />
          {submitted && invalid && <div id="input-error" className="validation" role="alert">{parsed.error && <p>{t(parsed.error)}</p>}{parsed.invalid.map((entry, index) => <p key={index}><strong>{entry.input}</strong>: {t(entry.error)}</p>)}</div>}
          <div className="form-bottom"><span className="muted small">{parsed.duplicates ? t('{count} duplicate input(s) removed', { count: parsed.duplicates }) : t('No wallet connection or signature')}</span>
            <div className="actions">{busy && <button type="button" className="icon-button" aria-label={t('Cancel scan')} title={t('Cancel scan')} onClick={cancel}><X size={18} /></button>}
              <button type="submit" className="primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />}{t(busy ? 'Scanning' : 'Scan addresses')}</button>
            </div>
          </div>
        </form>
      </section>
      <div role="status" aria-live="polite">{busy && <div className="loading"><LoaderCircle className="spin" size={18} />{progress ? t('{done} of {total} addresses checked', progress) : t('Resolving addresses')}</div>}</div>
      {batch && <section className="results" aria-label={t('Scan results')}>
        <div className="results-heading"><div><h2>{t('Scan results')}</h2><p className="muted small">{t('{count} addresses checked', { count: batch.results.length })}{batch.errors.length ? ` / ${t('{count} failed', { count: batch.errors.length })}` : ''}</p></div>
          <div className="actions"><button className="icon-button" title={t('Rescan current input')} aria-label={t('Rescan current input')} onClick={run}><RotateCw size={18} /></button><button className="icon-button" title={t('Export JSON')} aria-label={t('Export JSON')} onClick={download}><Download size={18} /></button></div>
        </div>
        {batch.errors.map((entry, index) => <div className="error-banner" role="alert" key={index}><AlertTriangle size={16} /><div><strong>{entry.inputs.map(short).join(', ') || t('Scan failed')}</strong><p>{errorText(entry.error)}</p></div></div>)}
        {batch.results.length > 0 && <>
          <div className="filter-bar"><label htmlFor="status-filter">{t('Status')}</label><SelectMenu id="status-filter" label={t('Status')} value={filter} onChange={setFilter} options={[['all', t('All statuses')], ...Object.entries(STATUS).map(([value, label]) => [value, t(label)])]} /><span className="muted small">{t('Amounts are in tokens, not USD')}</span></div>
          {campaigns.length === 0 && <p className="no-match">{t('No matching allocations were found for this filter. This does not establish past eligibility.')}</p>}
          {campaigns.map((campaign) => <section className="campaign" key={campaign.id}>
            <div className="campaign-heading"><div className={`token-mark ${campaign.color}`}>{campaign.symbol === 'DEEP' ? 'D' : campaign.symbol === 'WAL' ? 'W' : '@'}</div><div className="campaign-title"><h3>{campaign.name} <span>{t(campaign.round)}</span></h3><p className="muted small">{t(campaign.date)}</p></div></div>
            {batch.results.map((result) => {
              const group = result.groups.find((entry) => entry.campaignId === campaign.id);
              if (!group) return null;
              const items = group.items.filter((item) => filter === 'all' || item.status === filter);
              return <React.Fragment key={result.address}>
                {group.errors.map((error, index) => <p className="group-error" key={index}>{short(result.address)}: {errorText(error)}</p>)}
                {items.map((item) => <ResultRow key={item.objectId} {...{ result, item, campaign, group }} />)}
                {group.items.length === 0 && !group.complete && <ResultRow {...{ result, campaign, group }} />}
              </React.Fragment>;
            })}
          </section>)}
          <p className="disclaimer">{t('On-chain evidence is not a guarantee of redemption. Claimed amounts are historical, not wallet balances.')}</p>
        </>}
        <div className="sponsorship"><span>{t('Found this useful? Support its upkeep:')}</span><span>0xpest.sui</span><CopyButton value="0xpest.sui" label="Copy support address" /></div>
      </section>}
      {!batch && !busy && <section className="airdrop-context" aria-labelledby="airdrop-context-title">
        <div className="context-heading"><span className="eyebrow">{t('WORTH A SECOND LOOK')}</span><h2 id="airdrop-context-title">{t('Missed the announcement, not necessarily the airdrop.')}</h2></div>
        <div className="context-copy">
          <p>{t('Allocations can live in NFTs or wrappers, separate from your wallet balance.')}</p>
          <details><summary>{t('Does a closed claim page mean the tokens are gone?')}</summary><p>{t('Portal deadlines and contract rules can differ. Remaining funds and recovery permissions must be checked.')}</p></details>
          <details><summary>{t('Is an airdrop NFT proof that I can claim?')}</summary><p>{t('No. The official object type, withdrawal state and matching funds must all be verified.')}</p></details>
        </div>
      </section>}
      <SnapshotExplorer variant="details" />
    </main>
    <footer><span>suitokensaver</span><span>{t('Read-only / Mainnet')}</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><LocaleProvider><App /></LocaleProvider></React.StrictMode>);
