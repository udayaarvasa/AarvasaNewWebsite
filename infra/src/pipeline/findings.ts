export type Level = "pass" | "warn" | "fail";

export interface Finding {
  /** Stable rule id, e.g. "gltf.external-uri". */
  readonly rule: string;
  readonly level: Level;
  readonly message: string;
}

const RANK: Record<Level, number> = { pass: 0, warn: 1, fail: 2 };

export function worst(levels: Iterable<Level>): Level {
  let result: Level = "pass";
  for (const level of levels) if (RANK[level] > RANK[result]) result = level;
  return result;
}

/** Ordered findings for one asset. Order is the order checks ran, so output is deterministic. */
export class Findings {
  readonly list: Finding[] = [];

  pass(rule: string, message: string): void {
    this.list.push({ rule, level: "pass", message });
  }

  warn(rule: string, message: string): void {
    this.list.push({ rule, level: "warn", message });
  }

  fail(rule: string, message: string): void {
    this.list.push({ rule, level: "fail", message });
  }

  get status(): Level {
    return worst(this.list.map((f) => f.level));
  }

  get failed(): boolean {
    return this.status === "fail";
  }
}
