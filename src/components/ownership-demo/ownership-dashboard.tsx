"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Building2, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Copy, FileCheck2, FileText, Fingerprint, Globe2, LayoutDashboard, Layers3, LockKeyhole, Pause, Play, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Users, LogOut, Bell, X } from "lucide-react";
import { initialOwnershipDemo, issuedUnits, ownershipDemoReducer, unitShare, type DemoAction, type DemoDocument } from "@/lib/ownership-demo";
import { TestnetEvidence } from "./testnet-proof";
import styles from "./ownership-dashboard.module.css";

type View = "overview" | "passport" | "investors" | "activity" | "proof";
type Operation = "issue" | "transfer" | null;
const NAV = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "passport" as const, label: "Asset passport", icon: FileCheck2 },
  { id: "investors" as const, label: "Investors & units", icon: Users },
  { id: "activity" as const, label: "Activity ledger", icon: Activity },
  { id: "proof" as const, label: "Testnet proof", icon: Globe2 },
];
const TITLES: Record<View, [string, string]> = {
  proof: ["See the chain for yourself.", "Read deployed contracts and inspect independent transaction receipts."],
  overview: ["Your property, connected.", "One asset. Every document, unit and movement, connected."],
  passport: ["The record behind the residence.", "Review the source, calculate its fingerprint, and follow the audit trail."],
  investors: ["Every unit, accounted for.", "Explore allowlisted investors, balances and controlled transfers."],
  activity: ["A ledger you can follow.", "Every demo action leaves a record. Blocked actions leave balances untouched."],
};
const CONTRACT = "https://sepolia.basescan.org/address/0xa71018392a3F0cB140e1E6534ffD111F8116775B";
const format = (value: number) => value.toLocaleString("en-IN");

function BuildingIllustration() {
  return <svg viewBox="0 0 640 290" role="img" aria-label="Architectural illustration of a fictional residential development" className={styles.building}>
    <defs><linearGradient id="demo-sky" x2="0" y2="1"><stop stopColor="#e1e9e4"/><stop offset="1" stopColor="#f0eee4"/></linearGradient><linearGradient id="demo-glass" x2="1" y2="1"><stop stopColor="#54766d"/><stop offset="1" stopColor="#263f3a"/></linearGradient><linearGradient id="demo-side" x2="1"><stop stopColor="#9aafa1"/><stop offset="1" stopColor="#6d8c7a"/></linearGradient></defs>
    <rect width="640" height="290" fill="url(#demo-sky)"/>
    <circle cx="510" cy="65" r="37" fill="#fffaf0" opacity=".65"/>
    <path d="M0 219 180 190 391 200 640 222V290H0Z" fill="#d2d9cc"/>
    <path d="m96 240 260-53 240 57-242 52Z" fill="#b9c6b5"/>
    <path d="m124 231 229-42 207 45-219 43Z" fill="#eeeadd"/>
    <path d="m126 231 215 46v11l-215-44Z" fill="#b5b7a5"/><path d="m341 277 219-43v11l-219 43Z" fill="#9da99b"/>
    <path d="m176 213 79-17 129 26-82 19Z" fill="#78acaa"/><path d="m183 214 71-14 112 23-64 14Z" fill="#9ac5be"/>
    <g transform="translate(287,39)"><path d="m0 25 67-18 78 23v174l-78 19L0 202Z" fill="url(#demo-glass)"/><path d="m67 7 78 23v174l-78 19Z" fill="url(#demo-side)"/>{Array.from({length:12},(_,i)=><g key={i} transform={`translate(0,${i*14})`}><path d="m-6 25 73-18 84 23v5l-84-22-73 18Z" fill="#f1eee3"/><path d="m67 13 84 22v3l-84-22Z" fill="#bdc3b2"/></g>)}<path d="m-6 25 73-18 84 23-75 19Z" fill="#e4e5d9"/><path d="m16 24 50-12 58 17-49 12Z" fill="#9fb69b"/>{[20,44,91,120].map((x)=><path key={x} d={`M${x} 42V200`} stroke="#d2ded1" strokeWidth="1" opacity=".45"/>)}</g>
    <g transform="translate(168,82)"><path d="m0 24 65-15 57 18v130l-57 16L0 151Z" fill="url(#demo-glass)"/><path d="m65 9 57 18v130l-57 16Z" fill="url(#demo-side)"/>{Array.from({length:9},(_,i)=><path key={i} d={`m-5 ${24+i*14} 70-15 63 18v4l-63-17-70 14Z`} fill="#eeeadd"/>)}<path d="m-5 24 70-15 63 18-63 16Z" fill="#ebeade"/><path d="m10 24 53-11 47 13-49 12Z" fill="#a5bda0"/></g>
    {[120,148,484,518,548].map((x,i)=><g key={x} transform={`translate(${x},${211+(i%2)*12})`}><path d="M0 0v25" stroke="#8a8b6a" strokeWidth="3"/><path d="M0 0C-20-6-21 9-25 11-17 5-8 5 0 4M0 0C18-13 25-4 29 3 17-1 10 1 0 4M0 0C-10-15-18-14-23-10-10-8-5-4 0 4M0 0C5-17 19-20 23-11 12-10 7-6 0 4" fill="#66876c"/></g>)}
    <path d="M22 267c99-19 153-15 222 7" stroke="#eef0e8" strokeWidth="8" fill="none"/>
    <text x="26" y="32" fill="#4b6a5b" fontSize="9" letterSpacing="2.5">AARVASA / CONCEPT RESIDENCE</text>
    <text x="26" y="274" fill="#536b5b" fontSize="8" letterSpacing="1.2">FICTIONAL ASSET · ARCHITECTURAL ILLUSTRATION</text>
  </svg>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => previous?.focus();
  }, []);
  return <div className={styles.modalBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={styles.modal} onKeyDown={(e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }}>
      <div className={styles.modalHeading}><div><span className={styles.eyebrow}>Aarvasa / interactive demo</span><h2>{title}</h2></div><button onClick={onClose} className={styles.iconButton} aria-label="Close dialog"><X size={19}/></button></div>
      {children}
    </div>
  </div>;
}

export function OwnershipDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [state, dispatch] = useReducer(ownershipDemoReducer, undefined, initialOwnershipDemo);
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [chartFilter, setChartFilter] = useState("all");
  const [operation, setOperation] = useState<Operation>(null);
  const [recipient, setRecipient] = useState("B");
  const [sender, setSender] = useState("A");
  const [amount, setAmount] = useState("100");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [hashing, setHashing] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const runToken = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => () => { runToken.current += 1; }, []);
  const issued = issuedUnits(state);
  const anchored = state.documents.filter((d) => d.status === "anchored").length;
  const eligible = state.investors.filter((i) => i.allowlisted).length;
  const activeDocument = state.documents.find((d) => d.id === documentId);
  const events = state.events.filter((e) => `${e.id} ${e.title} ${e.detail}`.toLowerCase().includes(query.toLowerCase()) && (eventFilter === "all" || e.status === eventFilter));
  const chooseView = (next: View) => { setView(next); setQuery(""); setEventFilter("all"); };
  const reset = () => { runToken.current += 1; setRunning(false); setStep(0); setQuery(""); setEventFilter("all"); dispatch({ type: "reset" }); };
  const openOperation = (next: Operation) => { setAmount("100"); setRecipient("B"); setSender("A"); setOperation(next); };
  const fingerprint = async (content: string) => {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2,"0")).join("");
  };
  const anchorDocument = async (document: DemoDocument) => {
    setHashing(document.id);
    try { dispatch({ type: "anchor", document: document.id, digest: await fingerprint(document.content), at: Date.now() }); }
    finally { setHashing(null); }
  };
  const guidedDemo = async () => {
    const token = ++runToken.current;
    setRunning(true); setStep(0); setView("overview"); setQuery(""); setEventFilter("all"); dispatch({ type: "reset" });
    const initial = initialOwnershipDemo();
    const digest = await fingerprint(initial.documents[0].content);
    const actions: DemoAction[] = [
      { type:"anchor",document:"allocation",digest,at:0 },
      { type:"allowlist",investor:"C",enabled:true,at:0 },
      { type:"issue",investor:"C",amount:250,at:0 },
      { type:"transfer",from:"A",to:"B",amount:50,at:0 },
      { type:"pause",paused:true,at:0 },
      { type:"transfer",from:"A",to:"B",amount:10,at:0 },
      { type:"pause",paused:false,at:0 },
    ];
    for (let i=0; i<actions.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 850));
      if (runToken.current !== token) return;
      dispatch({ ...actions[i], at: Date.now() } as DemoAction); setStep(i+1);
    }
    setRunning(false);
  };
  const activityTable = (limit?: number) => <div className={styles.tableScroll}><table className={styles.activityTable}>
    <thead><tr><th>Event</th><th>Demo reference</th><th>Units</th><th>Record</th></tr></thead>
    <tbody>{events.slice(0,limit).map((event) => <tr key={event.id}><td><div className={styles.eventCell}><span className={event.status === "blocked" ? styles.blockedIcon : styles.eventIcon}>{event.status === "blocked" ? <LockKeyhole size={15}/> : event.title.includes("transfer") ? <ArrowUpRight size={16}/> : event.title.includes("Fingerprint") ? <Fingerprint size={16}/> : <Layers3 size={16}/>}</span><span><strong>{event.title}</strong><small>{event.detail}</small></span></div></td><td><span className={styles.mono}>{event.id}</span><small>{event.at ? new Date(event.at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : "Demo setup"}</small></td><td className={styles.numeric}>{event.units === null ? "—" : format(event.units)}</td><td><span className={event.status === "blocked" ? styles.badgeBlocked : styles.badgeNeutral}>{event.status === "blocked" ? "Blocked" : "Simulated"}</span></td></tr>)}</tbody>
  </table>{events.length === 0 && <div className={styles.empty}>No demo records match your search.</div>}</div>;
  const distribution = <div className={styles.card}>
    <div className={styles.cardHeading}><h2>Unit distribution</h2><span className={styles.badgeNeutral}>ADU-TEST</span></div>
    <div className={styles.distribution}><div className={styles.donut} style={{background:`conic-gradient(${state.investors.map((investor,index) => { const start=state.investors.slice(0,index).reduce((s,i)=>s+i.units,0)/issued*100; const end=start+investor.units/issued*100; return `${investor.color} ${start}% ${end}%`; }).join(",")})`}}><div><strong>{format(issued)}</strong><span>issued units</span></div></div><div className={styles.legend}>{state.investors.map((investor) => <div key={investor.id}><span style={{background:investor.color}}/><p>{investor.name}<strong>{unitShare(investor.units,issued)}%</strong></p></div>)}</div></div>
    <div className={styles.capacity}><div><span>Authorized supply</span><strong>{format(issued)} <em>/ {format(state.cap)}</em></strong></div><div className={styles.capacityTrack}><span style={{width:`${issued/state.cap*100}%`}}/></div><p>{format(state.cap-issued)} units remain unissued. No price or investment value is assigned.</p></div>
    <div className={styles.cardActions}><button className={styles.primaryButton} onClick={() => openOperation("issue")} disabled={running}><Plus size={15}/>Issue demo units</button><button className={styles.secondaryButton} onClick={() => openOperation("transfer")} disabled={running}>Transfer<ArrowUpRight size={15}/></button></div>
  </div>;

  return <div className={styles.shell} data-ownership-demo>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><span><Building2 size={22}/></span><div>Aarvasa<small>DIGITAL PROPERTY WORKSPACE</small></div></Link>
      <div className={styles.workspacePicker}><span className={styles.workspaceAvatar}>A</span><span>Demo workspace<small>Property operations</small></span><ChevronDown size={14}/></div>
      <p className={styles.navLabel}>WORKSPACE</p>
      <nav aria-label="Dashboard navigation">{NAV.map(({id,label,icon:Icon}) => <button key={id} onClick={() => chooseView(id)} className={view === id ? styles.activeNav : styles.navItem} aria-current={view === id ? "page" : undefined}><Icon size={18}/>{label}{id === "activity" && <span>{state.events.length}</span>}</button>)}</nav>
      <p className={styles.navLabel} style={{marginTop:28}}>PROPERTY OPERATIONS</p><nav aria-label="Property operations"><button className={styles.navItem} onClick={()=>openOperation("issue")} disabled={running}><Plus size={18}/>Issue demo units</button><button className={styles.navItem} onClick={()=>openOperation("transfer")} disabled={running}><ArrowUpRight size={18}/>Transfer units</button></nav>
      <div className={styles.sidebarNote}><span className={styles.statusDot}/>Local simulation<h3>A working model.<br/>A safe place to explore.</h3><p>Actions update this demo only. No wallet, payment or blockchain transaction is requested.</p><a href={CONTRACT} target="_blank" rel="noreferrer">View testnet reference<ArrowUpRight size={13}/></a></div>
      <div className={styles.sidebarBottom}><Link href="/"><ArrowDownLeft size={16}/>Back to Aarvasa</Link><span><CircleHelp size={14}/>Development preview</span></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><label className={styles.search}><Search size={18}/><input ref={searchInput} aria-label="Search activity" placeholder="Search records, units, activity…" value={query} onChange={(e)=>{setQuery(e.target.value);setView("activity");}}/><kbd>⌘ K</kbd></label><div className={styles.topbarRight}><span className={styles.networkPill}><span className={styles.statusDot}/>Local demo</span><button className={styles.iconButton} onClick={()=>chooseView("activity")} aria-label="View activity notifications"><Bell size={17}/></button><span className={styles.profileAvatar}>AV</span><div className={styles.profileName}><strong>Aarvasa workspace</strong><small>Property administrator</small></div><button className={styles.iconButton} onClick={onSignOut} aria-label="Sign out of demo"><LogOut size={16}/></button></div></header>
      <div className={styles.content}>
        <div className={styles.previewNotice}><ShieldCheck size={14}/><span>INTERACTIVE PROTOTYPE</span><span>Development Prototype — No real investment or property ownership.</span></div>
        <div className={styles.pageHeading}><div><p className={styles.eyebrow}>DIGITAL PROPERTY / {view === "overview" ? "YOUR WORKSPACE" : NAV.find((n)=>n.id===view)?.label.toUpperCase()}</p><h1>{TITLES[view][0]}</h1><p>{TITLES[view][1]}</p></div><div className={styles.headingActions}><button className={styles.secondaryButton} onClick={reset}><RotateCcw size={15}/>Reset demo</button><button className={styles.primaryButton} onClick={()=>void guidedDemo()} disabled={running}><Sparkles size={15}/>{running ? `Running · ${step}/7` : "Run guided demo"}</button></div></div>
        {running && <div className={styles.guideProgress} role="status"><span>Following a fingerprint, an issuance, a transfer and a blocked action…</span><div><span style={{width:`${step/7*100}%`}}/></div></div>}
        {state.feedback && <div className={state.feedback.tone === "error" ? styles.errorFeedback : styles.feedback} role={state.feedback.tone === "error" ? "alert" : "status"}>{state.feedback.tone === "error" ? <LockKeyhole size={16}/> : <CheckCircle2 size={16}/>}<span>{state.feedback.text}</span><small>Simulation only</small></div>}
        <div className={styles.mobileNav}>{NAV.map((n)=><button key={n.id} onClick={()=>chooseView(n.id)} aria-pressed={view===n.id}>{n.label}</button>)}</div>

        {view === "overview" && <>
          <div className={styles.overviewGrid}><section className={`${styles.card} ${styles.chartCard}`}><div className={styles.cardHeading}><div><span className={styles.eyebrow}>WORKSPACE ANALYTICS</span><h2>Ledger activity</h2><p>Every action, visible from the start.</p></div><button className={styles.textButton} onClick={()=>chooseView("activity")}>Audit trail<ArrowUpRight size={15}/></button></div><div className={styles.chartSummary}><strong>{state.events.length}<span>demo events</span></strong><div className={styles.chartTabs}>{[["all","All activity"],["units","Units"],["docs","Documents"]].map(([id,label])=><button key={id} aria-pressed={chartFilter===id} onClick={()=>setChartFilter(id)}>{label}</button>)}</div></div><div className={styles.barChart} role="img" aria-label="Number of local demo events by category">{[
            {label:"Passport",match:(t:string)=>t.includes("passport"),kind:"docs"},
            {label:"Documents",match:(t:string)=>t.includes("Fingerprint")||t.includes("reviewed"),kind:"docs"},
            {label:"Issuance",match:(t:string)=>t.includes("issued"),kind:"units"},
            {label:"Transfers",match:(t:string)=>t.includes("transferred"),kind:"units"},
            {label:"Permissions",match:(t:string)=>t.includes("Investor")||t.includes("Class"),kind:"units"},
            {label:"Blocked",match:(t:string)=>t.includes("blocked"),kind:"units"},
          ].map((category)=>{const count=chartFilter!=="all"&&chartFilter!==category.kind?0:state.events.filter(e=>category.match(e.title)).length;const max=Math.max(3,state.events.length/2);return <div key={category.label} className={styles.barColumn}><span>{count}</span><div className={styles.barTrack}><div style={{height:`${Math.min(100,count/max*100)}%`}}/></div><small>{category.label}</small></div>;})}</div><div className={styles.chartCaption}><span className={styles.statusDot}/>Live browser simulation<span>Counts update as you explore</span></div></section>{distribution}</div>
          <div className={styles.metrics}>
            {[
              {label:"Registered assets",value:"01",note:"Synthetic property passport",icon:Building2},
              {label:"Issued test units",value:format(issued),note:`${(issued/state.cap*100).toFixed(1)}% of authorized supply`,icon:Layers3},
              {label:"Document fingerprints",value:String(anchored).padStart(2,"0"),note:`${state.documents.length} sample documents available`,icon:Fingerprint},
              {label:"Allowlisted investors",value:String(eligible).padStart(2,"0"),note:`${state.investors.length} synthetic wallets`,icon:Users},
              {label:"Unissued capacity",value:format(state.cap-issued),note:"10,000-unit class cap",icon:Plus},
              {label:"Recorded actions",value:format(state.events.filter(e=>e.status==="recorded").length),note:"Traceable simulation records",icon:CheckCircle2},
              {label:"Blocked actions",value:format(state.events.filter(e=>e.status==="blocked").length),note:"No balance changes on refusal",icon:LockKeyhole},
              {label:"Class status",value:state.paused?"Paused":"Active",note:state.paused?"Issuance & transfers on hold":"Allowlisted transfers enabled",icon:ShieldCheck},
            ].map(item=><div className={styles.metric} key={item.label}><span><item.icon size={19}/>{item.label}</span><strong>{item.value}</strong><p>{item.note}</p></div>)}
          </div>
          <div className={styles.lowerGrid}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Waiting on your review</h2><p>Take the next step in your property record.</p></div><span className={styles.badgeNeutral}>{state.documents.filter(d=>d.status!=="anchored").length} pending</span></div><div className={styles.documents}>{state.documents.map(doc=><button className={styles.pendingRow} key={doc.id} onClick={()=>setDocumentId(doc.id)}><span className={styles.documentIcon}><FileText size={20}/></span><span><strong>{doc.title}</strong><small>{doc.status==="anchored"?"Fingerprint recorded":doc.status==="draft"?"Awaiting document review":"Ready to anchor fingerprint"}</small></span><ChevronRight size={16}/></button>)}</div></section><section className={styles.card}><div className={styles.cardHeading}><div><h2>Investor overview</h2><p>Allocation of issued demonstration units.</p></div><button className={styles.textButton} onClick={()=>chooseView("investors")}>Manage<ArrowUpRight size={15}/></button></div><div className={styles.documents}>{state.investors.map(i=><div className={styles.pendingRow} key={i.id}><span className={styles.investorAvatar} style={{background:i.color}}>{i.initials}</span><span><strong>{i.name}</strong><small>{i.allowlisted?"Allowlisted":"Awaiting allowlist"}</small></span><b>{format(i.units)}<small>test units</small></b></div>)}</div></section></div>
          <section className={styles.workflow}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>HOW THE MODEL WORKS</p><h2>One asset. Four connected records.</h2></div><span>Explore any part of the workflow<ArrowRight size={15}/></span></div><div className={styles.workflowSteps}>{[
            {title:"Asset passport",note:"A source-backed property record",icon:Building2,status:"Created",view:"passport" as View},
            {title:"Document fingerprints",note:"A digest, not the document, on-chain",icon:Fingerprint,status:`${anchored} recorded`,view:"passport" as View},
            {title:"Controlled issuance",note:"Test units with a fixed supply cap",icon:Layers3,status:`${format(issued)} units`,view:"investors" as View},
            {title:"Transfer ledger",note:"Allowlisted movements, traceable history",icon:Activity,status:"View records",view:"activity" as View},
          ].map((item,i)=><button key={item.title} onClick={()=>chooseView(item.view)}><div className={styles.stepTop}><span className={styles.stepIcon}><item.icon size={19}/></span><span>0{i+1}</span></div><h3>{item.title}</h3><p>{item.note}</p><span className={styles.stepStatus}>{item.status}<ChevronRight size={13}/></span></button>)}</div></section>
          <section className={styles.card}><div className={styles.cardHeading}><div><h2>Latest activity</h2><p>A transparent history of your demo workspace.</p></div><button className={styles.textButton} onClick={()=>chooseView("activity")}>View all activity<ArrowRight size={14}/></button></div>{activityTable(4)}</section>
        </>}

        {view === "proof" && <TestnetEvidence/>}

        {view === "passport" && <div className={styles.passportLayout}><section className={styles.card}><div className={styles.cardHeading}><div><span className={styles.eyebrow}>PASSPORT / DEMO-001</span><h2>Aarvasa Demo Residences</h2></div><span className={styles.badgeSuccess}><Check size={12}/>Synthetic asset</span></div><div className={styles.passportArt}><BuildingIllustration/></div><div className={styles.passportFacts}>{[["Asset type","Illustrative residential property"],["Record owner","Demo workspace"],["Unit class","ADU-TEST"],["Authorized supply","10,000 test units"],["Ownership claim","None — development prototype"],["Registry mode","Local simulation"]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className={styles.cardHeading}><div><h2>Source documents</h2><p>Review a record, then calculate and anchor its fingerprint.</p></div><span className={styles.badgeNeutral}>{anchored} / 3 anchored</span></div><div className={styles.documents}>{state.documents.map((document)=><div key={document.id} className={styles.documentRow}><span className={styles.documentIcon}><FileText size={21}/></span><div><strong>{document.title}</strong><small>{document.category} · Synthetic sample</small><span className={document.status === "anchored" ? styles.badgeSuccess : styles.badgeNeutral}>{document.status === "anchored" ? "Demo anchored" : document.status === "reviewed" ? "Reviewed" : "Awaiting review"}</span></div><button className={styles.textButton} onClick={()=>{setDocumentId(document.id);setCopied(false);}}>Open record<ArrowUpRight size={15}/></button></div>)}</div></section><aside className={styles.explainer}><Fingerprint size={27}/><h2>The fingerprint travels.<br/>The file stays private.</h2><p>A SHA-256 digest identifies this exact document content. Changing even one character produces a different fingerprint.</p><div><span>01</span><p>Inspect the synthetic source record.</p></div><div><span>02</span><p>Review it before anchoring.</p></div><div><span>03</span><p>Calculate the real fingerprint in your browser.</p></div><div><span>04</span><p>Record it in the simulated registry.</p></div><small>A fingerprint proves a content match. It does not establish legal title or certify that a document is authentic.</small></aside></div>}

        {view === "investors" && <><div className={styles.investorLayout}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Investors & balances</h2><p>Only allowlisted investors can receive or transfer test units.</p></div><span className={styles.badgeNeutral}>{eligible} eligible</span></div><div className={styles.investors}>{state.investors.map((investor)=><div className={styles.investorRow} key={investor.id}><span className={styles.investorAvatar} style={{background:investor.color}}>{investor.initials}</span><div><strong>{investor.name}</strong><small>WLT-{investor.id} · Synthetic wallet</small></div><div className={styles.balance}><strong>{format(investor.units)}</strong><small>{unitShare(investor.units,issued)}% of issued units</small></div><button className={investor.allowlisted ? styles.allowlistedButton : styles.allowlistButton} disabled={running} onClick={()=>dispatch({type:"allowlist",investor:investor.id,enabled:!investor.allowlisted,at:Date.now()})} aria-label={`${investor.allowlisted ? "Remove" : "Add"} ${investor.name} ${investor.allowlisted ? "from" : "to"} allowlist`}>{investor.allowlisted ? <Check size={13}/> : <Plus size={13}/>}{investor.allowlisted ? "Allowlisted" : "Allowlist"}</button></div>)}</div><div className={styles.note}><ShieldCheck size={17}/><p>Allowlisting here is a demo permission. Real identity verification and investor onboarding are not implemented by this screen.</p></div></section>{distribution}</div><section className={`${styles.card} ${styles.controlsCard}`}><div><span className={state.paused ? styles.badgeBlocked : styles.badgeSuccess}><span className={styles.statusDot}/>{state.paused ? "Class paused" : "Class active"}</span><h2>Contract controls</h2><p>Pause issuance and transfers to see the protection in action. Balances and document records remain intact.</p></div><button className={state.paused ? styles.primaryButton : styles.secondaryButton} disabled={running} onClick={()=>dispatch({type:"pause",paused:!state.paused,at:Date.now()})}>{state.paused ? <Play size={15}/> : <Pause size={15}/>} {state.paused ? "Resume demo class" : "Pause demo class"}</button></section></>}

        {view === "activity" && <section className={styles.card}><div className={styles.cardHeading}><div><h2>Activity ledger</h2><p>{events.length} records · All records on this screen are simulated.</p></div><label className={styles.filterLabel}>Show<select aria-label="Filter activity" value={eventFilter} onChange={(e)=>setEventFilter(e.target.value)}><option value="all">All events</option><option value="recorded">Recorded actions</option><option value="blocked">Blocked actions</option></select></label></div>{activityTable()}<div className={styles.note}><Globe2 size={17}/><p>SIM references identify local demo events, not blockchain transaction hashes. The actual prototype contract can be inspected on <a href={CONTRACT} target="_blank" rel="noreferrer">Base Sepolia ↗</a>.</p></div></section>}
        <footer className={styles.workspaceFooter}><span><LockKeyhole size={12}/>No real assets. No payments. No transactions sent.</span><span>Aarvasa · Digital property prototype</span></footer>
      </div>
    </div>
    {operation && <Modal title={operation === "issue" ? "Issue demo units" : "Transfer demo units"} onClose={()=>setOperation(null)}><form onSubmit={(e)=>{e.preventDefault();if(operation === "issue")dispatch({type:"issue",investor:recipient,amount:Number(amount),at:Date.now()});else dispatch({type:"transfer",from:sender,to:recipient,amount:Number(amount),at:Date.now()});setOperation(null);}}><p className={styles.modalIntro}>Aarvasa Demo Residences · ADU-TEST<br/>This updates the browser simulation. No blockchain transaction is sent.</p>{operation === "transfer" && <label className={styles.field}>From investor<select value={sender} onChange={(e)=>setSender(e.target.value)}>{state.investors.map((i)=><option key={i.id} value={i.id}>{i.name} · {format(i.units)} units</option>)}</select></label>}<label className={styles.field}>{operation === "issue" ? "Issue to" : "Transfer to"}<select value={recipient} onChange={(e)=>setRecipient(e.target.value)}>{state.investors.map((i)=><option key={i.id} value={i.id}>{i.name} · {i.allowlisted ? "Allowlisted" : "Not allowlisted"}</option>)}</select></label><label className={styles.field}>Number of units<input type="number" min="1" step="1" required value={amount} onChange={(e)=>setAmount(e.target.value)}/></label><div className={styles.modalSummary}><span>{operation === "issue" ? "Unissued capacity" : "Sender balance"}</span><strong>{format(operation === "issue" ? state.cap-issued : state.investors.find((i)=>i.id===sender)?.units ?? 0)} units</strong></div>{state.paused && <p className={styles.inlineWarning}>The class is paused. This action will be blocked.</p>}<div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={()=>setOperation(null)}>Cancel</button><button type="submit" className={styles.primaryButton}>{operation === "issue" ? "Simulate issuance" : "Simulate transfer"}<ArrowRight size={15}/></button></div></form></Modal>}
    {activeDocument && <Modal title={activeDocument.title} onClose={()=>setDocumentId(null)}><p className={styles.modalIntro}>{activeDocument.category} · Synthetic sample document</p><div className={styles.sourceRecord}><span className={styles.eyebrow}>SOURCE CONTENT</span><p>{activeDocument.content}</p></div>{activeDocument.digest && <div className={styles.fingerprintBox}><div><span>SHA-256 fingerprint</span><button className={styles.iconButton} aria-label="Copy document fingerprint" onClick={async()=>{try{await navigator.clipboard.writeText(activeDocument.digest!);setCopied(true);}catch{setCopied(false);}}}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button></div><code>{activeDocument.digest}</code><small>Calculated in your browser · Simulated anchoring</small></div>}<div className={styles.note}><Fingerprint size={17}/><p>{activeDocument.status === "draft" ? "Review this sample before recording its fingerprint." : activeDocument.status === "anchored" ? "This exact content is in the demo registry. The action is idempotent: anchoring it again adds no duplicate record." : "The fingerprint is real SHA-256. Only the registry entry is simulated."}</p></div><div className={styles.modalActions}><button className={styles.secondaryButton} onClick={()=>setDocumentId(null)}>Close</button>{activeDocument.status === "draft" ? <button className={styles.primaryButton} onClick={()=>dispatch({type:"review",document:activeDocument.id,at:Date.now()})} disabled={running}><FileCheck2 size={15}/>Review sample</button> : <button className={styles.primaryButton} onClick={()=>void anchorDocument(activeDocument)} disabled={hashing!==null || running}><Fingerprint size={15}/>{hashing ? "Fingerprinting…" : activeDocument.status === "anchored" ? "Verify no duplicate" : "Simulate anchoring"}</button>}</div></Modal>}
  </div>;
}
