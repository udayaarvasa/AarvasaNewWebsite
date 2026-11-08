"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { OwnershipDashboard } from "./ownership-dashboard";
import styles from "./ownership-dashboard.module.css";

export function OwnershipDemoEntry() {
  const root = useRef<HTMLDivElement>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // This full-screen development workspace replaces the site's visible chrome.
    const previous: [HTMLElement, boolean][] = [];
    let node: HTMLElement | null = root.current;
    while (node && node !== document.body) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
          previous.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      node = node.parentElement;
    }
    return () => { for (const [element, inert] of previous) element.inert = inert; };
  }, []);
  return <div ref={root}>{signedIn ? <OwnershipDashboard onSignOut={()=>{setSignedIn(false);setPassword("");setError("");}}/> : <div className={`${styles.shell} ${styles.signInShell}`}>
    <header className={styles.signInHeader}><Link href="/" className={styles.brand}><span><Building2 size={25}/></span><div>Aarvasa<small>DIGITAL PROPERTY CONSOLE</small></div></Link><span className={styles.signInTag}><ShieldCheck size={15}/>Development preview</span></header>
    <main className={styles.authPanel}><span className={styles.authEyebrow}>PROPERTY. CONNECTED.</span><h1>Welcome <em>back.</em></h1><p>Sign in to your Aarvasa property console.</p><form onSubmit={(e)=>{e.preventDefault();if(name.trim().toLowerCase()==="demo"&&password==="aarvasa"){setSignedIn(true);setError("");}else setError("Use the demo credentials shown below.");}}>
      <label className={styles.authField}><span>Workspace name</span><div><UserRound size={18}/><input autoComplete="off" required placeholder="Enter workspace name" value={name} onChange={e=>setName(e.target.value)}/></div></label>
      <label className={styles.authField}><span>Password</span><div><LockKeyhole size={18}/><input autoComplete="off" required type={visible?"text":"password"} placeholder="Enter demo password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={visible?"Hide password":"Show password"} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      <p className={styles.authSession}><ShieldCheck size={14}/>Local demo session · resets when you leave</p>
      {error&&<p role="alert" className={styles.authError}>{error}</p>}
      <button className={styles.authSubmit} type="submit">Sign in to demo<ArrowRight size={18}/></button>
    </form><div className={styles.demoCredentials}><span>EXPLORE THE WORKING MODEL</span><p>Workspace: <strong>demo</strong><span> / </span>Password: <strong>aarvasa</strong></p><button onClick={()=>{setName("demo");setPassword("aarvasa");setError("");}}>Use demo credentials<ArrowRight size={13}/></button></div><p className={styles.authFootnote}>Interactive prototype. No real investment or property ownership.</p></main>
    <footer className={styles.signInFooter}><span>THE NEXT CHAPTER OF PROPERTY</span><div><strong>REEF 999</strong><p>Al Furjan, Dubai · Developer render</p></div></footer>
  </div>}</div>;
}
