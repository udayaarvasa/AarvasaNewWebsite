"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Fingerprint, Globe2, RefreshCw, Upload } from "lucide-react";
import { TESTNET, type TestnetProof } from "@/lib/testnet-proof";
import styles from "./ownership-dashboard.module.css";
const explorer = "https://sepolia.basescan.org";
const examples = [
  ["Issue 1,000 test units","0xab249fbb9e4dd8719c552e399a54e6de5f66899862d98ac31562a5a8c2cfe16d","Successful issuance"],
  ["Transfer to unapproved wallet","0x633eeacea5c5b44a4cc1779bf5f4530f9c55662740139472e649e1fff16a820c","Reverted · NotAllowlisted"],
  ["Issue beyond the supply cap","0x71dbe5e99f6ff8b78d4cf3459072a8cb724d2dc8d309f552f9e78bae303f8c68","Reverted · ERC20ExceededCap"],
  ["Transfer while class was paused","0xa40268c82c83b0d92521d6e96a2b20353a49ec73240048fb8afcd1e6cb442f8e","Reverted · EnforcedPause"],
];
export function TestnetEvidence() {
  const [proof,setProof]=useState<TestnetProof|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [digest,setDigest]=useState("");
  const [fileError,setFileError]=useState("");
  const uploadVersion=useRef(0);
  const check = async()=>{
    setLoading(true);setError("");setProof(null);
    try {const response=await fetch("/api/blockchain/testnet-proof",{cache:"no-store"});if(!response.ok)throw new Error();setProof(await response.json());}
    catch{setError("The testnet RPC could not be checked. No live balances are being shown. Use the explorer links below or try again.");}
    finally{setLoading(false);}
  };
  return <div className={styles.proofView}>
    <section className={`${styles.card} ${styles.proofIntro}`}><div><span className={styles.eyebrow}>REAL TESTNET / READ ONLY</span><h2>Evidence beyond the dashboard.</h2><p>This view reads deployed contracts on Base Sepolia. It is independent of the simulator: demo actions never change these balances. No wallet or transaction is requested.</p></div><button className={styles.primaryButton} onClick={()=>void check()} disabled={loading}><RefreshCw size={15}/>{loading?"Reading testnet…":proof?"Refresh testnet proof":"Check live testnet"}</button></section>
    {error&&<div className={styles.errorFeedback} role="alert">{error}</div>}
    {proof&&<><div className={styles.feedback} role="status"><CheckCircle2 size={17}/><span>RPC checked Base Sepolia · Chain {proof.chainId} · Block {proof.block}<br/><small>Read at {new Date(proof.checkedAt).toLocaleString("en-IN")} · Snapshot may be cached for 30 seconds.</small></span></div><div className={styles.metrics}>{[
      ["On-chain issued units",proof.units.supply,`Cap: ${proof.units.cap} test units`],
      ["Investor A balance",proof.units.investors[0].balance,"Read directly from the contract"],
      ["Investor B balance",proof.units.investors[1].balance,"Read directly from the contract"],
      ["On-chain class",proof.units.paused?"Paused":"Active","At the checked block"],
    ].map(([label,value,note])=><div className={styles.metric} key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></div>)}</div></>}
    <div className={styles.lowerGrid}><section className={styles.card}><div className={styles.cardHeading}><div><Globe2 size={22}/><h2>Units contract</h2><p>A fictional asset, with publicly traceable unit movements.</p></div></div><div className={styles.proofBody}><a className={styles.proofAddress} href={`${explorer}/address/${TESTNET.units}`} target="_blank" rel="noreferrer">{TESTNET.units}<ArrowUpRight size={14}/></a><p>The recorded 50-unit transfer can be inspected independently: sender, recipient, amount, block and receipt status.</p><a className={styles.proofLink} href={`${explorer}/tx/${TESTNET.transfer}`} target="_blank" rel="noreferrer">Inspect transfer receipt<ArrowUpRight size={15}/></a>{proof&&<div className={styles.proofResult}><CheckCircle2 size={16}/><span>Receipt + Transfer event checked<br/>50 units · block {proof.transfer.block}</span></div>}</div></section>
    <section className={styles.card}><div className={styles.cardHeading}><div><Fingerprint size={22}/><h2>Document registry</h2><p>A real SHA-256 fingerprint of a synthetic PDF.</p></div></div><div className={styles.proofBody}><a className={styles.proofAddress} href={`${explorer}/address/${TESTNET.registry}`} target="_blank" rel="noreferrer">{TESTNET.registry}<ArrowUpRight size={14}/></a><a className={styles.proofLink} href={`${explorer}/tx/${TESTNET.anchor}`} target="_blank" rel="noreferrer">Inspect anchor receipt<ArrowUpRight size={15}/></a>{proof&&<div className={styles.proofResult}><CheckCircle2 size={16}/><span>Registry lookup + DocumentAnchored event agree<br/>Anchored {new Date(proof.document.timestamp).toLocaleDateString("en-IN")}</span></div>}<a className={styles.proofLink} href="/demo/base-sepolia-synthetic.pdf" download>Download synthetic sample PDF<ArrowUpRight size={15}/></a><label className={styles.uploadField}><Upload size={17}/>Choose a file to compare its fingerprint<input type="file" onChange={async e=>{const version=++uploadVersion.current;setDigest("");setFileError("");const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024){setFileError("Choose a file smaller than 20 MB.");return;}try{const bytes=await file.arrayBuffer();const hash=await crypto.subtle.digest("SHA-256",bytes);if(version===uploadVersion.current)setDigest(Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join(""));}catch{if(version===uploadVersion.current)setFileError("The fingerprint could not be calculated. Try the sample again.");}}}/></label><p className={styles.proofFine}>Your file stays in your browser. Only its fingerprint is calculated; nothing is uploaded.</p>{fileError&&<p role="alert">{fileError}</p>}{digest&&<div className={styles.fingerprintBox}><code>{digest}</code><p>{proof ? digest===proof.document.digest?"Content match: this exact fingerprint is recorded in the testnet registry.":"No match to the published sample fingerprint.":digest===TESTNET.digest.slice(2)?"Matches the published sample. Click Check live testnet to confirm the registry entry.":"Does not match the published sample fingerprint."}</p></div>}</div></section></div>
    <section className={styles.card}><div className={styles.cardHeading}><div><h2>Check the rules on the explorer</h2><p>Historical test transactions. Open a receipt to inspect what the contract accepted or rejected.</p></div></div><div className={styles.documents}>{examples.map(([label,hash,status])=><a className={styles.pendingRow} key={hash} href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer"><span><strong>{label}</strong><small>{status} · deployment test record</small></span><ArrowUpRight size={17}/></a>)}</div><div className={styles.note}>These contracts represent test units and sample documents only. A fingerprint match does not prove legal ownership or document authenticity. No property title, payment or investment is created.</div></section>
  </div>;
}
