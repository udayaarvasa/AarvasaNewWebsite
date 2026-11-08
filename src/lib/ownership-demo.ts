/** Browser-only demonstration of the prototype's core rules. No RPC, keys,
 * payments, storage or database calls. Every record is explicitly simulated. */
export type DemoInvestor = { id: string; name: string; initials: string; allowlisted: boolean; units: number; color: string };
export type DemoDocument = { id: string; title: string; category: string; content: string; status: "draft" | "reviewed" | "anchored"; digest?: string };
export type DemoEvent = { id: string; title: string; detail: string; units: number | null; status: "recorded" | "blocked"; at: number };
export type OwnershipDemo = {
  cap: number; paused: boolean; investors: DemoInvestor[]; documents: DemoDocument[];
  events: DemoEvent[]; feedback: { tone: "success" | "error" | "info"; text: string } | null;
};
export type DemoAction =
  | { type: "reset" }
  | { type: "allowlist"; investor: string; enabled: boolean; at: number }
  | { type: "issue"; investor: string; amount: number; at: number }
  | { type: "transfer"; from: string; to: string; amount: number; at: number }
  | { type: "pause"; paused: boolean; at: number }
  | { type: "review"; document: string; at: number }
  | { type: "anchor"; document: string; digest: string; at: number };

export const issuedUnits = (state: OwnershipDemo) => state.investors.reduce((sum, investor) => sum + investor.units, 0);
export const unitShare = (units: number, total: number) => total > 0 ? (units / total * 100).toFixed(1) : "0.0";

export function initialOwnershipDemo(): OwnershipDemo {
  return {
    cap: 10_000, paused: false, feedback: null,
    investors: [
      { id: "A", name: "Investor A", initials: "IA", allowlisted: true, units: 700, color: "#620a12" },
      { id: "B", name: "Investor B", initials: "IB", allowlisted: true, units: 300, color: "#b28b50" },
      { id: "C", name: "Investor C", initials: "IC", allowlisted: false, units: 0, color: "#b7a095" },
    ],
    documents: [
      { id: "allocation", title: "Synthetic allocation schedule", category: "Allocation record", content: "Aarvasa Demo Residences. Synthetic allocation: Investor A 700 test units, Investor B 300 test units. No real investment or property ownership.", status: "reviewed" },
      { id: "agreement", title: "Demo purchase agreement", category: "Sample agreement", content: "Fictional agreement for Aarvasa Demo Residences. Demonstration only. No sale, payment, legal title or property ownership is represented.", status: "reviewed" },
      { id: "building", title: "Illustrative building record", category: "Asset specification", content: "Fictional residential building used solely to demonstrate the Aarvasa Asset Passport workflow. Not a real project or an official planning record.", status: "draft" },
    ],
    events: [
      { id: "SIM-0003", title: "Test units transferred", detail: "Investor A → Investor B · 300 units", units: 300, status: "recorded", at: 0 },
      { id: "SIM-0002", title: "Initial units issued", detail: "1,000 demo units assigned to Investor A", units: 1000, status: "recorded", at: 0 },
      { id: "SIM-0001", title: "Asset passport created", detail: "Aarvasa Demo Residences · synthetic asset", units: null, status: "recorded", at: 0 },
    ],
  };
}

function event(state: OwnershipDemo, at: number, title: string, detail: string, units: number | null = null, blocked = false): OwnershipDemo {
  const entry: DemoEvent = { id: `SIM-${String(state.events.length + 1).padStart(4, "0")}`, title, detail, units, status: blocked ? "blocked" : "recorded", at };
  return { ...state, events: [entry, ...state.events], feedback: { tone: blocked ? "error" : "success", text: detail } };
}

export function ownershipDemoReducer(state: OwnershipDemo, action: DemoAction): OwnershipDemo {
  if (action.type === "reset") return initialOwnershipDemo();
  const refuse = (message: string) => event(state, action.at, "Action blocked", message, null, true);
  if (action.type === "pause") {
    if (state.paused === action.paused) return state;
    return event({ ...state, paused: action.paused }, action.at, action.paused ? "Class paused" : "Class resumed", action.paused ? "Issuance and transfers are paused. Balances stay unchanged." : "Issuance and allowlisted transfers are available again.");
  }
  if (action.type === "allowlist") {
    const investor = state.investors.find((i) => i.id === action.investor);
    if (!investor) return refuse("Investor not found.");
    if (investor.allowlisted === action.enabled) return state;
    return event({ ...state, investors: state.investors.map((i) => i.id === investor.id ? { ...i, allowlisted: action.enabled } : i) }, action.at, action.enabled ? "Investor allowlisted" : "Investor removed from allowlist", `${investor.name} ${action.enabled ? "can receive and transfer" : "cannot receive or transfer"} demo units.`);
  }
  if (action.type === "review" || action.type === "anchor") {
    const document = state.documents.find((d) => d.id === action.document);
    if (!document) return refuse("Document not found.");
    if (action.type === "review") {
      if (document.status !== "draft") return state;
      return event({ ...state, documents: state.documents.map((d) => d.id === document.id ? { ...d, status: "reviewed" } : d) }, action.at, "Document reviewed", `${document.title} is ready for fingerprinting.`);
    }
    if (document.status === "anchored") return { ...state, feedback: { tone: "info", text: "This document fingerprint is already in the demo registry." } };
    if (document.status !== "reviewed") return refuse("Review the document before anchoring its fingerprint.");
    if (!/^[a-f0-9]{64}$/.test(action.digest)) return refuse("A valid SHA-256 fingerprint is required.");
    return event({ ...state, documents: state.documents.map((d) => d.id === document.id ? { ...d, status: "anchored", digest: action.digest } : d) }, action.at, "Fingerprint recorded", `${document.title} · SHA-256 fingerprint added to the simulated registry.`);
  }
  if (!Number.isSafeInteger(action.amount) || action.amount <= 0) return refuse("Enter a positive whole number of units.");
  if (state.paused) return refuse("The class is paused. No units were moved or issued.");
  if (action.type === "issue") {
    const investor = state.investors.find((i) => i.id === action.investor);
    if (!investor?.allowlisted) return refuse("The recipient must be allowlisted before units can be issued.");
    if (issuedUnits(state) + action.amount > state.cap) return refuse("This issuance would exceed the 10,000-unit supply cap.");
    return event({ ...state, investors: state.investors.map((i) => i.id === investor.id ? { ...i, units: i.units + action.amount } : i) }, action.at, "Test units issued", `${action.amount.toLocaleString()} demo units issued to ${investor.name}.`, action.amount);
  }
  const sender = state.investors.find((i) => i.id === action.from);
  const receiver = state.investors.find((i) => i.id === action.to);
  if (!sender?.allowlisted || !receiver?.allowlisted) return refuse("Both investors must be allowlisted. No units were moved.");
  if (sender.id === receiver.id) return refuse("Choose two different investors.");
  if (sender.units < action.amount) return refuse("The sender does not hold enough units. Balances stay unchanged.");
  return event({ ...state, investors: state.investors.map((i) => i.id === sender.id ? { ...i, units: i.units - action.amount } : i.id === receiver.id ? { ...i, units: i.units + action.amount } : i) }, action.at, "Test units transferred", `${sender.name} → ${receiver.name} · ${action.amount.toLocaleString()} demo units`, action.amount);
}
