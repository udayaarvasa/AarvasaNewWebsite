import { type ByteBudget, formatBytes } from "../media-budgets";
import type { Findings } from "./findings";

/** Applies a byte budget: FAIL above the hard limit, WARN above desktop or mobile targets. */
export function checkByteBudget(findings: Findings, label: string, bytes: number, budget: ByteBudget): void {
  const size = formatBytes(bytes);
  if (bytes > budget.hardLimit) {
    findings.fail("size.hard-limit", `${label} is ${size}; the hard limit is ${formatBytes(budget.hardLimit)}`);
  } else if (bytes > budget.desktopTarget) {
    findings.warn("size.desktop-target", `${label} is ${size}; exceeds the desktop target of ${formatBytes(budget.desktopTarget)}`);
  } else if (bytes > budget.mobileTarget) {
    findings.warn("size.mobile-target", `${label} is ${size}; exceeds the mobile target of ${formatBytes(budget.mobileTarget)}`);
  } else {
    findings.pass("size.budget", `${label} is ${size}; within the mobile target of ${formatBytes(budget.mobileTarget)}`);
  }
}

/** WARN above desktop/mobile count targets (triangles, gaussians, pixels). */
export function checkCountBudget(
  findings: Findings,
  rule: string,
  label: string,
  value: number,
  budget: { readonly mobileTarget: number; readonly desktopTarget: number },
  extraWarning = "",
): void {
  const n = value.toLocaleString("en-US");
  if (value > budget.desktopTarget) {
    findings.warn(rule, `${label} ${n} exceeds the desktop target of ${budget.desktopTarget.toLocaleString("en-US")}${extraWarning}`);
  } else if (value > budget.mobileTarget) {
    findings.warn(rule, `${label} ${n} exceeds the mobile target of ${budget.mobileTarget.toLocaleString("en-US")}`);
  } else {
    findings.pass(rule, `${label} ${n} is within the mobile target`);
  }
}
