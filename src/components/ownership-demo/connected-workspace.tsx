"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Building2, CheckCircle2, FileText, Fingerprint, Globe2, Layers3, LayoutDashboard, LockKeyhole, Pause, Play, Plus, RefreshCw, ShieldCheck, Users, Wallet } from "lucide-react";
import { formatEther, getAddress, isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import { CONNECTED, createChainGateway, publicTestnet, restoreJournal, sameAddress, transactionError, walletRejected, type ChainAction, type Intent, type LiveActivity, type LiveSnapshot, type TransactionRecord, type WalletProvider } from "@/lib/connected-testnet";
import { Modal } from "./transaction-modal";
import styles from "./ownership-dashboard.module.css";

type View="overview"|"investors"|"documents"|"ledger"|"guide";
const NAV=[{id:"overview",label:"Overview",icon:LayoutDashboard},{id:"investors",label:"Investors & units",icon:Users},{id:"documents",label:"Document registry",icon:Fingerprint},{id:"ledger",label:"Transaction ledger",icon:Activity},{id:"guide",label:"Roles & setup",icon:ShieldCheck}] as const;
const TITLES:Record<View,[string,string]>={overview:["Connected to the real testnet.","Contract state and wallet-approved actions on Base Sepolia."],investors:["Every unit, on the ledger.","Allowlist, issue and transfer through the deployed contract."],documents:["Record a real fingerprint.","Synthetic documents only. Anchoring writes an irreversible public testnet record."],ledger:["Follow every transaction.","Submitted is not confirmed. Receipts are checked against the exact action."],guide:["The right wallet for each action.","Contract permissions determine what a wallet can do."]};
const JOURNAL="aarvasa-connected-transactions-v1";
const WATCH="aarvasa-connected-watch-v1";
const DOCUMENT="aarvasa-connected-document-v1";
const short=(v:string)=>`${v.slice(0,7)}…${v.slice(-5)}`;
const number=(v:string)=>BigInt(v).toLocaleString("en-IN");
const explorer=(hash:string)=>`${CONNECTED.explorer}/tx/${hash}`;
const provider=()=> (window as unknown as {ethereum?:WalletProvider}).ethereum;
const unsettled=(r:TransactionRecord)=>["awaiting-wallet","unknown","pending"].includes(r.status);

export function ConnectedWorkspace(){
  const root=useRef<HTMLDivElement>(null);
  const gateway=useRef(createChainGateway(publicTestnet()));
  const [view,setView]=useState<View>("overview");
  const [account,setAccount]=useState<Address>();
  const [chain,setChain]=useState<number>();
  const [snapshot,setSnapshot]=useState<LiveSnapshot|null>(null);
  const [activity,setActivity]=useState<LiveActivity|null>(null);
  const [watch,setWatch]=useState<{label:string;address:Address}[]>(CONNECTED.investors);
  const [journal,setJournal]=useState<TransactionRecord[]>([]);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [storageError,setStorageError]=useState(false);
  const [form,setForm]=useState<"issue"|"transfer"|"watch"|null>(null);
  const [recipient,setRecipient]=useState<string>(CONNECTED.investors[1].address);
  const [amount,setAmount]=useState("10");
  const [label,setLabel]=useState("");
  const [review,setReview]=useState<{intent:Intent;gas:string;detail:string}|null>(null);
  const [synthetic,setSynthetic]=useState<{id:string;content:string;digest:Hex;record:Hex}|null>(null);
  const [anchored,setAnchored]=useState<{block:string;record:string}|null>(null);
  const [lookupBusy,setLookupBusy]=useState(false);
  const [recoverHash,setRecoverHash]=useState("");
  const mounted=useRef(true);
  const refreshVersion=useRef(0);
  const journalRef=useRef<TransactionRecord[]>([]);
  const activeWatch=useRef(watch);
  const activeAccount=useRef(account);
  useEffect(()=>{activeWatch.current=watch;activeAccount.current=account;},[watch,account]);
  const commit=useCallback((next:TransactionRecord[])=>{
    journalRef.current=next;setJournal(next);
    try{localStorage.setItem(JOURNAL,JSON.stringify(next));setStorageError(false);}
    catch{setStorageError(true);}
  },[]);
  const patch=useCallback((id:string,changes:Partial<TransactionRecord>)=>commit(journalRef.current.map(r=>r.id===id?{...r,...changes}:r)),[commit]);
  const refresh=useCallback(async()=>{
    const version=++refreshVersion.current;setLoading(true);setError("");setSnapshot(null);
    try{
      const next=await gateway.current.snapshot(activeWatch.current,activeAccount.current);
      if(mounted.current&&version===refreshVersion.current)setSnapshot(next);
    }catch(e){if(mounted.current&&version===refreshVersion.current)setError(`Live state unavailable. ${transactionError(e)}`);}
    finally{if(mounted.current&&version===refreshVersion.current)setLoading(false);}
  },[]);
  const inspect=useCallback(async(record:TransactionRecord)=>{
    if(!record.hash)return;
    patch(record.id,{status:"pending",message:"Waiting for three confirmations. No automatic resubmission."});
    try{
      const result=await gateway.current.receipt(record,(hash,cancelled)=>patch(record.id,{hash,status:cancelled?"cancelled":"pending",message:cancelled?"Wallet replaced this action with a different transaction.":"Wallet repriced the transaction; tracking the replacement."}));
      patch(record.id,{...result,message:result.status==="confirmed"?"Exact transaction confirmed with three confirmations.":result.status==="reverted"?"The contract reverted this transaction. Gas may have been spent; this action did not change contract state.":"The requested action was replaced or cancelled in the wallet."});
      if(mounted.current)await refresh();
    }catch(e){if(transactionError(e).includes("does not match")){patch(record.id,{status:"unknown",hash:undefined,message:"The supplied hash does not match this action. Check your wallet for the correct transaction hash."});return;}patch(record.id,{status:"pending",message:`Receipt not confirmed yet. ${transactionError(e)} Check the explorer or check again; do not resend.`});}
  },[patch,refresh]);
  useEffect(()=>{
    mounted.current=true;
    queueMicrotask(()=>{if(!mounted.current)return;try{
      const stored=restoreJournal(localStorage.getItem(JOURNAL));journalRef.current=stored;setJournal(stored);
      const restoredDocument=JSON.parse(localStorage.getItem(DOCUMENT)??"null");
      if(restoredDocument&&typeof restoredDocument.content==="string"&&restoredDocument.content.startsWith("Aarvasa Demo Residences — synthetic test record ")&&restoredDocument.content.length<1000&&/^0x[0-9a-f]{64}$/.test(restoredDocument.digest)&&/^0x[0-9a-f]{64}$/.test(restoredDocument.record))setSynthetic(restoredDocument);
      const custom=JSON.parse(localStorage.getItem(WATCH)??"[]");
      if(Array.isArray(custom))setWatch(previous=>[...previous,...custom.filter(i=>i&&typeof i.label==="string"&&isAddress(i.address)&&!previous.some(p=>sameAddress(p.address,i.address))).slice(0,8)]);
    }catch{setStorageError(true);}
    setReady(true);});
    return()=>{mounted.current=false;};
  },[]);
  useEffect(()=>{if(ready)queueMicrotask(()=>void refresh());},[ready,watch,account,refresh]);
  useEffect(()=>{
    const previous:[HTMLElement,boolean][]=[];let node:HTMLElement|null=root.current;
    while(node&&node!==document.body){for(const sibling of Array.from(node.parentElement?.children??[])){if(sibling!==node&&sibling instanceof HTMLElement&&!["SCRIPT","STYLE","LINK"].includes(sibling.tagName)){previous.push([sibling,sibling.inert]);sibling.inert=true;}}node=node.parentElement;}
    return()=>{for(const [element,inert]of previous)element.inert=inert;};
  },[]);
  useEffect(()=>{
    const wallet=provider();if(!wallet)return;
    const invalidate=()=>{setAccount(undefined);setChain(undefined);setSnapshot(null);setReview(null);refreshVersion.current++;setNotice("Wallet selection changed. Connect again to reload its permissions. Existing transactions remain in the ledger.");};
    wallet.on?.("accountsChanged",invalidate);wallet.on?.("chainChanged",invalidate);wallet.on?.("disconnect",invalidate);
    return()=>{wallet.removeListener?.("accountsChanged",invalidate);wallet.removeListener?.("chainChanged",invalidate);wallet.removeListener?.("disconnect",invalidate);};
  },[]);
  const connect=async()=>{
    setError("");setNotice("");
    const wallet=provider();if(!wallet){setError("No browser wallet was found. Open this page in a browser with a trusted Ethereum wallet extension, or in your wallet’s browser.");return;}
    try{
      const accounts=await wallet.request({method:"eth_requestAccounts"});const id=await wallet.request({method:"eth_chainId"});
      if(!Array.isArray(accounts)||!isAddress(accounts[0]))throw new Error("No wallet account was selected.");
      setChain(Number(id));setAccount(getAddress(accounts[0]));setSnapshot(null);setReview(null);
      if(Number(id)!==CONNECTED.chainId)setNotice("Your wallet is on another network. Switch to Base Sepolia before preparing a transaction.");
    }catch(e){setError(transactionError(e));}
  };
  const switchChain=async()=>{
    try{await provider()?.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x14a34"}]});setNotice("Base Sepolia selected. Connect again to reload wallet permissions.");}
    catch(e){setError(`Could not switch network. Select Base Sepolia (chain 84532) in your wallet. ${transactionError(e)}`);}
  };
  const canAct=!!snapshot&&!!account&&chain===CONNECTED.chainId&&!busy&&!journal.some(unsettled)&&!storageError;
  const prepare=async(action:ChainAction,detail:string)=>{
    if(!canAct||!account||busyRef.current)return;
    busyRef.current=true;setBusy(true);setError("");setNotice("");
    try{
      await gateway.current.walletIdentity(provider()!,account);
      const prepared=await gateway.current.prepare(action,account,crypto.randomUUID());setReview({...prepared,detail});setForm(null);
    }catch(e){setError(`Nothing was sent. ${transactionError(e)}`);}
    finally{busyRef.current=false;setBusy(false);}
  };
  const send=async()=>{
    if(!review||!canAct||busyRef.current)return;
    const wallet=provider();if(!wallet)return;
    busyRef.current=true;setBusy(true);setError("");
    const intent=review.intent;
    const record:TransactionRecord={...intent,status:"awaiting-wallet",message:"Waiting for wallet approval. Do not submit this action again."};
    // Persist before asking the wallet, so a reload cannot silently lose an uncertain request.
    try{localStorage.setItem(JOURNAL,JSON.stringify([record,...journalRef.current].slice(0,30)));}
    catch{setStorageError(true);setError("Browser storage is unavailable. Nothing was sent; enable storage before sending transactions.");busyRef.current=false;setBusy(false);return;}
    commit([record,...journalRef.current].slice(0,30));setReview(null);setView("ledger");
    try{
      // The contract simulation is repeated immediately before requesting a signature.
      await gateway.current.walletIdentity(wallet,intent.from);
      await publicTestnet().call({account:intent.from,to:intent.to,data:intent.data,value:BigInt(0)});
    }catch(e){patch(intent.id,{status:"rejected",message:`Preflight stopped this action before the wallet prompt. ${transactionError(e)}`});busyRef.current=false;setBusy(false);return;}
    try{
      const hash=await gateway.current.requestSignature(wallet,intent);
      const pending={...record,hash,status:"pending" as const};patch(intent.id,{hash,status:"pending",message:"Submitted to the wallet network. Awaiting three confirmations."});
      await inspect(pending);
    }catch(e){patch(intent.id,{status:walletRejected(e)?"rejected":"unknown",message:walletRejected(e)?transactionError(e):`Submission outcome is unknown. ${transactionError(e)} Check wallet activity and supply the transaction hash; do not repeat the action.`});}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  };
  const newDocument=async()=>{
    setAnchored(null);setError("");const id=crypto.randomUUID();
    const content=`Aarvasa Demo Residences — synthetic test record ${id}. Created ${new Date().toISOString()}. No real property, investment, personal data or legal ownership is represented.`;
    const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(content));
    const digest=`0x${Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("")}` as Hex;
    const document={id,content,digest,record:keccak256(toBytes(`aarvasa-synthetic:${id}`))};
    setSynthetic(document);try{localStorage.setItem(DOCUMENT,JSON.stringify(document));}catch{setStorageError(true);}
  };
  const lookup=async()=>{
    if(!synthetic)return;setLookupBusy(true);setError("");
    try{const result=await gateway.current.lookup(synthetic.digest);setAnchored(result[0]?{block:result[4].toString(),record:result[1]}:null);setNotice(result[0]?"This exact fingerprint is recorded in the deployed registry.":"This fingerprint is not in the deployed registry.");}
    catch(e){setError(transactionError(e));}finally{setLookupBusy(false);}
  };
  const readActivity=async()=>{setActivity(null);setError("");try{setActivity(await gateway.current.activity());}catch(e){setError(`Recent logs unavailable. ${transactionError(e)}`);}};
  const pending=journal.find(unsettled);
  const balance= snapshot?.investors.find(i=>sameAddress(i.address,account))?.balance;
  const supply=snapshot?BigInt(snapshot.supply):BigInt(0);
  const journalTable=<div className={styles.tableScroll}><table className={styles.activityTable}><thead><tr><th>Action</th><th>Transaction</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{journal.map(record=><tr key={record.id}><td><strong>{record.label}</strong><small>{new Date(record.createdAt).toLocaleString("en-IN")} · {short(record.from)}</small><small>{record.message}</small></td><td>{record.hash?<a className={styles.proofLink} href={explorer(record.hash)} target="_blank" rel="noreferrer">{short(record.hash)}<ArrowUpRight size={13}/></a>:"No hash returned"}</td><td><span className={record.status==="confirmed"?styles.badgeSuccess:record.status==="reverted"||record.status==="unknown"?styles.badgeBlocked:styles.badgeNeutral}>{record.status}</span>{record.block&&<small>Block {record.block}</small>}</td><td>{record.hash&&<button className={styles.textButton} disabled={busy||record.status==="confirmed"||record.status==="reverted"||record.status==="cancelled"} onClick={()=>void inspect(record)}>Check receipt</button>}</td></tr>)}</tbody></table>{journal.length===0&&<div className={styles.empty}>No transactions have been requested in this browser. Balances above come from the contract.</div>}</div>;
  return <div ref={root} className={`${styles.shell} ${styles.connectedShell}`} data-connected-testnet>
    <aside className={styles.sidebar}><Link href="/" className={styles.brand}><span><Building2 size={22}/></span><div>Aarvasa<small>CONNECTED TESTNET</small></div></Link><div className={styles.workspacePicker}><Globe2 size={21}/><span>Base Sepolia<small>Chain 84532 · test units only</small></span></div><p className={styles.navLabel}>ON-CHAIN WORKSPACE</p><nav aria-label="Connected testnet navigation">{NAV.map(({id,label,icon:Icon})=><button className={view===id?styles.activeNav:styles.navItem} key={id} onClick={()=>setView(id)}><Icon size={18}/>{label}</button>)}</nav><div className={styles.sidebarNote}><span className={styles.statusDot}/>Wallet-signed transactions<h3>Every action.<br/>Your approval.</h3><p>Private keys stay in your wallet. Only contract-authorized wallets can issue, control or anchor.</p><Link href="/blockchain/demo">Open browser simulator<ArrowUpRight size={13}/></Link></div><div className={styles.sidebarBottom}><Link href="/"><ArrowLeft size={15}/>Back to Aarvasa</Link><span>Fictional asset · no legal title</span></div></aside>
    <div className={styles.workspace}><header className={styles.topbar}><div className={styles.connectedMode}><Globe2 size={17}/><strong>Connected testnet</strong><span>Base Sepolia</span></div><div className={styles.topbarRight}><button className={styles.secondaryButton} onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/>{loading?"Reading…":"Refresh chain"}</button><button className={styles.primaryButton} onClick={()=>void connect()} disabled={busy}><Wallet size={15}/>{account?short(account):"Connect wallet"}</button></div></header><main className={styles.content}>
      <div className={styles.previewNotice}><ShieldCheck size={14}/><span>REAL TESTNET TRANSACTIONS</span><span>Synthetic assets only — no investment, payment or legal property ownership.</span></div><div className={styles.pageHeading}><div><p className={styles.eyebrow}>AARVASA / CONNECTED WORKSPACE</p><h1>{TITLES[view][0]}</h1><p>{TITLES[view][1]}</p></div><Link href="/blockchain/demo" className={styles.secondaryButton}>Browser simulator<ArrowUpRight size={14}/></Link></div>
      <div className={styles.mobileNav}>{NAV.map(n=><button key={n.id} onClick={()=>setView(n.id)} aria-pressed={view===n.id}>{n.label}</button>)}</div>
      {error&&!form&&!review&&<div className={styles.errorFeedback} role="alert"><LockKeyhole size={16}/><span>{error}</span></div>}{notice&&<div className={styles.feedback} role="status"><CheckCircle2 size={16}/><span>{notice}</span></div>}
      {storageError&&<div className={styles.errorFeedback}>Browser storage is unavailable. Transactions are disabled so a pending request cannot be lost.</div>}
      {account&&chain!==CONNECTED.chainId&&<div className={styles.errorFeedback}><span>Your wallet is on chain {chain}. Transactions require Base Sepolia.</span><button className={styles.secondaryButton} onClick={()=>void switchChain()}>Switch to Base Sepolia</button></div>}
      {pending&&<div className={styles.pendingNotice}><Activity size={17}/><span>{pending.label}: <strong>{pending.status}</strong>. New actions are locked until this request is resolved.</span><button className={styles.textButton} onClick={()=>setView("ledger")}>Open ledger<ArrowRight size={14}/></button></div>}
      {snapshot&&<div className={styles.chainStamp}><span className={styles.statusDot}/>Live contract snapshot · block {snapshot.block} · {new Date(snapshot.checkedAt).toLocaleTimeString("en-IN")}{account&&<span>Wallet roles: {[snapshot.roles.issuer&&"Issuer",snapshot.roles.controller&&"Controller",snapshot.roles.anchorer&&"Anchorer"].filter(Boolean).join(", ")||"Investor / no operational role"}</span>}</div>}
      {!snapshot&&<section className={`${styles.card} ${styles.proofIntro}`}><div><h2>{loading?"Reading deployed contracts…":"Live balances unavailable"}</h2><p>Balances and transaction controls appear only after a successful RPC read. No simulated values are substituted.</p></div></section>}
      {view==="overview"&&<><div className={styles.metrics}>{[["On-chain supply",snapshot?number(snapshot.supply):"—","Whole ADU-TEST units",Layers3],["Authorized cap",snapshot?number(snapshot.cap):"—","Maximum contract supply",ShieldCheck],["Class state",snapshot?(snapshot.paused?"Paused":"Active"):"—","Issuance & transfer controls",Activity],["Your balance",balance!==undefined?number(balance):"—",account?"Connected wallet":"Connect a wallet",Wallet]].map(([label,value,note,Icon])=>{const MetricIcon=Icon as typeof Layers3;return <div key={String(label)} className={styles.metric}><span><MetricIcon size={18}/>{String(label)}</span><strong>{String(value)}</strong><p>{String(note)}</p></div>;})}</div><div className={styles.lowerGrid}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Unit allocation on-chain</h2><p>Balances read at the same block. Watchlist entries do not grant permissions.</p></div></div><div className={styles.documents}>{snapshot?.investors.map(i=><div className={styles.pendingRow} key={i.address}><span className={styles.investorAvatar}>{i.label.slice(0,2).toUpperCase()}</span><span><strong>{i.label}</strong><a className={styles.proofAddress} href={`${CONNECTED.explorer}/address/${i.address}`} target="_blank" rel="noreferrer">{short(i.address)}</a></span><b>{number(i.balance)}<small>{supply>BigInt(0)?(Number(BigInt(i.balance)*BigInt(10000)/supply)/100).toFixed(2):"0"}% of issued units</small></b></div>)}</div><div className={styles.cardActions}><button className={styles.primaryButton} onClick={()=>setView("investors")}>Manage units<ArrowRight size={14}/></button></div></section><section className={`${styles.card} ${styles.connectedHelp}`}><Globe2 size={25}/><h2>A transaction is a real request.</h2><p>Prepare an action, review its exact destination and units, then approve it in your wallet. The dashboard shows confirmed only after the matching receipt has three confirmations.</p><div><span>01</span>Contract simulation checks the rules.</div><div><span>02</span>Your wallet approves and submits.</div><div><span>03</span>The receipt confirms the outcome.</div><div><span>04</span>Balances are read again from the contract.</div><button className={styles.textButton} onClick={()=>setView("guide")}>See roles and setup<ArrowRight size={15}/></button></section></div><section className={styles.card}><div className={styles.cardHeading}><div><h2>Your transaction requests</h2><p>Browser-local tracking of real testnet requests. This is not a complete global audit log.</p></div><button className={styles.textButton} onClick={()=>setView("ledger")}>Open ledger<ArrowRight size={14}/></button></div>{journalTable}</section></>}
      {view==="investors"&&<><section className={styles.card}><div className={styles.cardHeading}><div><h2>Investors & on-chain balances</h2><p>Add a watch address, then allowlist it through the controller wallet.</p></div><button className={styles.secondaryButton} onClick={()=>{setError("");setLabel("");setRecipient("");setForm("watch");}} disabled={watch.length>=10}><Plus size={15}/>Watch wallet</button></div><div className={styles.documents}>{snapshot?.investors.map(i=><div className={styles.investorRow} key={i.address}><span className={styles.investorAvatar}>{i.label.slice(0,2).toUpperCase()}</span><div><strong>{i.label}</strong><a className={styles.proofAddress} href={`${CONNECTED.explorer}/address/${i.address}`} target="_blank" rel="noreferrer">{short(i.address)}</a></div><div className={styles.balance}><strong>{number(i.balance)}</strong><small>test units</small></div><button className={i.allowlisted?styles.allowlistedButton:styles.allowlistButton} disabled={!canAct||!snapshot.roles.controller} onClick={()=>void prepare({kind:"allowlist",recipient:i.address,allowed:!i.allowlisted},`${i.allowlisted?"Remove":"Add"} ${i.label} (${i.address}) ${i.allowlisted?"from":"to"} the contract allowlist.`)}>{i.allowlisted?"Allowlisted":"Allowlist wallet"}</button></div>)}</div><div className={styles.cardActions}><button className={styles.primaryButton} disabled={!canAct||!snapshot?.roles.issuer||snapshot.paused} onClick={()=>{setError("");setAmount("10");setRecipient(watch[0].address);setForm("issue");}}><Plus size={15}/>Issue test units</button><button className={styles.secondaryButton} disabled={!canAct||snapshot?.paused||!snapshot?.investors.find(i=>sameAddress(i.address,account))?.allowlisted} onClick={()=>{setError("");setAmount("10");setRecipient(watch.find(i=>!sameAddress(i.address,account))?.address??"");setForm("transfer");}}>Transfer from your wallet<ArrowUpRight size={15}/></button></div><div className={styles.note}>Issuance requires the issuer role. Transfers use the connected investor’s own wallet. Neither the website administrator nor the controller can move another investor’s units.</div></section><section className={`${styles.card} ${styles.controlsCard}`}><div><h2>Class controls</h2><p>{snapshot?.paused?"Class is paused. Issuance and transfers are blocked.":"Pause issuance and transfers with the controller wallet."}</p></div><button className={styles.secondaryButton} disabled={!canAct||!snapshot?.roles.controller} onClick={()=>snapshot&&void prepare({kind:"pause",paused:!snapshot.paused},`${snapshot.paused?"Resume":"Pause"} issuance and transfers for the deployed test unit class.`)}>{snapshot?.paused?<Play size={15}/>:<Pause size={15}/>} {snapshot?.paused?"Resume class":"Pause class"}</button></section></>}
      {view==="documents"&&<><section className={styles.card}><div className={styles.cardHeading}><div><h2>Synthetic document registry</h2><p>Generate a fictional record, review its content, then anchor its fingerprint.</p></div><button className={styles.secondaryButton} disabled={busy} onClick={()=>void newDocument()}><FileText size={15}/>{synthetic?"New synthetic record":"Generate synthetic record"}</button></div><div className={styles.proofBody}>{synthetic?<><div className={styles.sourceRecord}><span className={styles.eyebrow}>REVIEW THIS EXACT CONTENT</span><p>{synthetic.content}</p></div><div className={styles.fingerprintBox}><span>SHA-256 fingerprint</span><code>{synthetic.digest.slice(2)}</code><small>Only this fingerprint and an opaque record reference are sent on-chain.</small></div><div className={styles.cardActions}><button className={styles.primaryButton} disabled={!canAct||!snapshot?.roles.anchorer||!!anchored} onClick={()=>void prepare({kind:"anchor",digest:synthetic.digest,record:synthetic.record},`Anchor the SHA-256 fingerprint of synthetic record ${synthetic.id}. This public testnet entry cannot be deleted.`)}><Fingerprint size={15}/>Review & anchor on testnet</button><button className={styles.secondaryButton} disabled={lookupBusy} onClick={()=>void lookup()}><RefreshCw size={15}/>Verify on-chain</button></div>{anchored&&<div className={styles.proofResult}><CheckCircle2 size={17}/>Fingerprint found in the deployed registry · block {anchored.block}</div>}<button className={styles.textButton} onClick={()=>{const blob=new Blob([synthetic.content],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`aarvasa-synthetic-${synthetic.id}.txt`;a.click();URL.revokeObjectURL(url);}}>Download this synthetic record<ArrowUpRight size={14}/></button></>:<p>No real property documents can be uploaded through this connected workflow. Generate a synthetic record to test actual anchoring.</p>}</div><div className={styles.note}>Anchoring proves that a fingerprint was recorded. It does not authenticate the document or establish legal property ownership.</div></section></>}
      {view==="ledger"&&<><section className={styles.card}><div className={styles.cardHeading}><div><h2>Transaction requests from this browser</h2><p>Unknown and pending requests are never resent automatically.</p></div></div>{journalTable}</section>{journal.some(r=>r.status==="unknown"&&!r.hash)&&<section className={`${styles.card} ${styles.proofIntro}`}><div><h2>Resolve an uncertain wallet request</h2><p>Check your wallet’s activity. If it was submitted, paste its hash below. A receipt is accepted only if the sender, destination, calldata, value and chain match the original action.</p><label className={styles.field}>Transaction hash<input placeholder="0x…" value={recoverHash} onChange={e=>setRecoverHash(e.target.value)}/></label><button className={styles.secondaryButton} disabled={!/^0x[0-9a-f]{64}$/i.test(recoverHash)||busy} onClick={()=>{const record=journal.find(r=>r.status==="unknown"&&!r.hash)!;const next={...record,hash:recoverHash as Hex};patch(record.id,{hash:next.hash,status:"pending"});void inspect(next);}}>Check matching transaction</button><p>If the wallet confirms nothing was sent, you can dismiss the unresolved request. This does not cancel any transaction already on-chain.</p><button className={styles.textButton} disabled={busy} onClick={()=>{const record=journal.find(r=>r.status==="unknown"&&!r.hash)!;patch(record.id,{status:"cancelled",message:"Dismissed locally after checking wallet activity. This does not cancel an on-chain transaction."});}}>I checked my wallet; dismiss local request</button></div></section>}<section className={styles.card}><div className={styles.cardHeading}><div><h2>Recent contract events</h2><p>{activity?`Blocks ${activity.from}–${activity.to}. This window is not the complete contract history.`:"Read the latest 420-block window from both contracts."}</p></div><button className={styles.secondaryButton} onClick={()=>void readActivity()}><RefreshCw size={15}/>Read recent events</button></div><div className={styles.documents}>{activity?.events.map((event,i)=><a className={styles.pendingRow} key={`${event.hash}-${i}`} href={explorer(event.hash!)} target="_blank" rel="noreferrer"><span><strong>{event.name}</strong><small>{event.detail}</small><small>Block {event.block}</small></span><ArrowUpRight size={16}/></a>)}{activity&&activity.events.length===0&&<div className={styles.empty}>No decoded events in this recent block window.</div>}</div><div className={styles.note}>For older transactions, use the <a href={`${CONNECTED.explorer}/address/${CONNECTED.units}`} target="_blank" rel="noreferrer">contract explorer ↗</a>. Reverted transactions emit no events; inspect their receipts.</div></section></>}
      {view==="guide"&&<section className={styles.card}><div className={styles.cardHeading}><div><h2>Wallet roles and operational setup</h2><p>Demo login credentials grant no on-chain authority.</p></div></div><div className={styles.documents}>{[["Issuer wallet","Can issue new test units to allowlisted investors within the cap. Cannot transfer investor balances."],["Controller wallet","Can allowlist wallets and pause/resume the class. Cannot issue units or move investor units."],["Investor wallet","Can transfer only its own units, to an allowlisted receiver, while the class is active."],["Anchorer wallet","Can record synthetic document fingerprints in the registry. Entries cannot be deleted."],["Administrator","Manages contract roles through the contract's delayed governance process; role changes are not exposed in this dashboard."]].map(([title,body])=><div className={styles.pendingRow} key={title}><span><strong>{title}</strong><small>{body}</small></span></div>)}</div><div className={styles.proofBody}>{snapshot&&<div className={styles.sourceRecord}><span className={styles.eyebrow}>CURRENT ON-CHAIN ROLE HOLDERS</span><p>Issuer: {snapshot.roleWallets.issuer}<br/>Controller: {snapshot.roleWallets.controller}</p><small>The connected wallet’s anchorer permission is checked directly against the registry.</small></div>}<p>Use a trusted Ethereum wallet in Chrome or the wallet’s own browser. Select Base Sepolia, chain 84532, and use test ETH for gas. Connect the existing role wallet for the action you want to demonstrate. No key import or role change is performed by the website.</p><p>Every transaction requires a separate wallet approval. A failed receipt may still consume test gas. Rejected preflight checks send nothing.</p>{account&&snapshot&&<p>Connected wallet test ETH balance: <strong>{formatEther(BigInt(snapshot.gas))}</strong></p>}<a className={styles.proofAddress} href={`${CONNECTED.explorer}/address/${CONNECTED.units}`} target="_blank" rel="noreferrer">Units contract: {CONNECTED.units}<ArrowUpRight size={14}/></a><a className={styles.proofAddress} href={`${CONNECTED.explorer}/address/${CONNECTED.registry}`} target="_blank" rel="noreferrer">Registry: {CONNECTED.registry}<ArrowUpRight size={14}/></a></div></section>}
      <footer className={styles.workspaceFooter}><span><LockKeyhole size={12}/>Base Sepolia only · Test units are not legal property ownership</span><span>Keys remain in your wallet</span></footer>
    </main></div>
    {form&&<Modal title={form==="watch"?"Watch wallet":form==="issue"?"Issue test units":"Transfer test units"} onClose={()=>setForm(null)}>{error&&<p role="alert" className={styles.inlineWarning}>{error}</p>}<form onSubmit={e=>{e.preventDefault();setError("");if(!isAddress(recipient)){setError("Enter a valid receiving address.");return;}if(form==="watch"){const next={label:label.trim()||`Wallet ${short(recipient)}`,address:getAddress(recipient)};if(watch.some(i=>sameAddress(i.address,next.address))){setError("This wallet is already in the watchlist.");return;}setWatch([...watch,next]);try{localStorage.setItem(WATCH,JSON.stringify([...watch.slice(2),next]));}catch{setStorageError(true);}setForm(null);return;}void prepare(form==="issue"?{kind:"issue",recipient:getAddress(recipient),amount,reference:keccak256(toBytes(crypto.randomUUID()))}:{kind:"transfer",recipient:getAddress(recipient),amount},`${form==="issue"?"Issue":"Transfer"} ${amount} whole ADU-TEST units ${form==="transfer"?`from your wallet ${account} `:""}to ${getAddress(recipient)}.`);}}>{form==="watch"&&<label className={styles.field}>Display label<input value={label} maxLength={50} onChange={e=>setLabel(e.target.value)}/></label>}<label className={styles.field}>{form==="watch"?"Wallet address":"Receiving wallet address"}<input required placeholder="0x…" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>{form!=="watch"&&<label className={styles.field}>Whole test units<input inputMode="numeric" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>}<p className={styles.modalIntro}>{form==="watch"?"Adds a local watch entry only. Contract permissions and balances remain unchanged.":"The next step simulates the exact call and shows a transaction review. Nothing is sent until you approve in your wallet."}</p><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={()=>setForm(null)}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={busy}>{form==="watch"?"Add watch entry":"Prepare transaction"}<ArrowRight size={15}/></button></div></form></Modal>}
    {review&&<Modal title={review.intent.label} onClose={()=>setReview(null)}>{error&&<p role="alert" className={styles.inlineWarning}>{error}</p>}<p className={styles.modalIntro}>{review.detail}</p><div className={styles.sourceRecord}><span className={styles.eyebrow}>EXACT TRANSACTION</span><p>Network: Base Sepolia (84532)<br/>From: {review.intent.from}<br/>Contract: {review.intent.to}<br/>Native value sent: 0 ETH<br/>Estimated gas units: {review.gas}</p><code className={styles.calldata}>{review.intent.data}</code></div><p className={styles.modalIntro}>The contract call passed preflight. Network conditions and contract state can change before mining. Your wallet displays the gas fee in test ETH.</p><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={()=>setReview(null)}>Cancel</button><button className={styles.primaryButton} disabled={!canAct} onClick={()=>void send()}><Wallet size={15}/>Approve in wallet</button></div></Modal>}
  </div>;
}
