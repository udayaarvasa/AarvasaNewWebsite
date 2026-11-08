"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./ownership-dashboard.module.css";
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
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
      <div className={styles.modalHeading}><div><span className={styles.eyebrow}>Aarvasa / connected testnet</span><h2>{title}</h2></div><button onClick={onClose} className={styles.iconButton} aria-label="Close dialog"><X size={19}/></button></div>
      {children}
    </div>
  </div>;
}

