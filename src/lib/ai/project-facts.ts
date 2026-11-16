import { formatCurrency } from "../currency.ts";
import type { Project } from "../project-types.ts";

/**
 * Everything the developer filed for a project, written out for the advisor.
 *
 * The advisor used to receive a one-line summary: name, completion and the
 * smallest size and lowest price of each configuration. Payment plans,
 * released-unit counts and the inventory date never reached it, so asked
 * "what are the payment plans for REEF 996?" it replied that the plan "has not
 * been published", while the project page listed two. A fact the page shows
 * must be a fact the advisor can quote.
 *
 * Only filed facts appear here. Nothing is derived, estimated or scored.
 */

/**
 * Date of the original REEF inventory sheet. New dated releases carry their
 * own date on the project record.
 */
export const DEVELOPER_INVENTORY_DATE = "28 June 2026";

const range = (min: number, max: number, fmt: (n: number) => string): string =>
  max > min ? `${fmt(min)} – ${fmt(max)}` : fmt(min);

export function projectFacts(project: Project): string {
  const money = (n: number) => formatCurrency(n, project.currency);
  const sqft = (n: number) => `${n.toLocaleString("en-US")} sq.ft`;
  const lines: string[] = [];

  lines.push(`${project.name} by ${project.developer}, ${project.location}, ${project.city}, ${project.country}.`);
  if (project.completion) lines.push(`Completion: ${project.completion}.`);
  if (project.buildingConfig) lines.push(`Building configuration: ${project.buildingConfig}.`);
  if (project.totalUnits) {
    lines.push(`${project.kind === "plots" ? "Plots in the layout" : "Total residences"}: ${project.totalUnits}.`);
  }

  if (project.fromPrice > 0) {
    lines.push(`Starting price: ${money(project.fromPrice)}.`);
  } else if (project.ratePerSqft) {
    lines.push(`Rate: ${money(project.ratePerSqft)} per sq.ft.`);
  } else {
    lines.push("Price: on request.");
  }
  if (project.rateNote) lines.push(project.rateNote);

  if (project.unitTypes.length > 0) {
    if (project.availableUnits !== null) {
      lines.push(
        `Availability: ${project.availableUnits} units released, from the developer's inventory of ${project.inventoryDate ?? DEVELOPER_INVENTORY_DATE}.`,
      );
    }
    lines.push("Configurations:");
    for (const u of project.unitTypes) {
      const parts = [`  - ${u.label}: ${range(u.minSqft, u.maxSqft, sqft)}${project.unitAreaBasis === "net" ? " net" : ""}`];
      if (u.fromPrice > 0) parts.push(`from ${money(u.fromPrice)}`);
      else parts.push("price on request");
      if (u.available !== null) parts.push(`${u.available} available`);
      lines.push(parts.join(", "));
    }
  }

  if (project.paymentPlans.length > 0) {
    lines.push("Payment plans published by the developer:");
    for (const plan of project.paymentPlans) {
      const terms = [
        `down payment ${plan.downPayment}`,
        `during construction ${plan.duringConstruction}`,
        `final payment ${plan.final}`,
      ];
      lines.push(`  - ${plan.name}: ${terms.join("; ")}${plan.note ? ` (${plan.note})` : ""}.`);
    }
  } else {
    lines.push("Payment plans: none published on Aarvasa for this project.");
  }

  if (project.approvals.length > 0) {
    lines.push(`Approvals supplied by the developer: ${project.approvals.join("; ")}.`);
  } else {
    lines.push("Approvals: none supplied to Aarvasa for this project.");
  }
  if (project.usps.length > 0) lines.push(`Developer's stated highlights: ${project.usps.join("; ")}.`);

  const nearby = project.nearby.filter((n) => n.minutes !== null);
  if (nearby.length > 0) {
    lines.push(`Travel times stated by the developer: ${nearby.map((n) => `${n.place} ${n.minutes} min`).join("; ")}.`);
  }

  return lines.join("\n");
}
