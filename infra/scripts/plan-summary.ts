/**
 * Offline review summary of the synthesized cloud assembly (cdk.out).
 * Reads local files only. It never calls AWS and never deploys.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Template = { Resources?: Record<string, { Type: string; Properties?: Record<string, unknown> }> };
type Manifest = {
  artifacts: Record<string, { type: string; environment?: string; properties?: Record<string, unknown> }>;
};

const root = join(__dirname, "..", "..", "..");
const outDir = join(root, "cdk.out");
if (!existsSync(join(outDir, "manifest.json"))) {
  console.error("cdk.out not found. Run `npm run synth` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8")) as Manifest;
const problems: string[] = [];

console.log("Aarvasa immersive media: development infrastructure plan (offline)\n");

for (const [name, artifact] of Object.entries(manifest.artifacts)) {
  if (artifact.type !== "aws:cloudformation:stack") continue;
  const props = artifact.properties ?? {};
  const template = JSON.parse(readFileSync(join(outDir, String(props.templateFile)), "utf8")) as Template;
  const counts = new Map<string, number>();
  for (const r of Object.values(template.Resources ?? {})) counts.set(r.Type, (counts.get(r.Type) ?? 0) + 1);

  console.log(`■ ${name}  (${artifact.environment})${props.terminationProtection ? "  [termination protection]" : ""}`);
  for (const [type, n] of [...counts].sort()) console.log(`    ${String(n).padStart(2)} × ${type}`);

  if (props.assumeRoleArn) problems.push(`${name}: references a bootstrap deploy role`);
  if (props.requiresBootstrapStackVersion) problems.push(`${name}: requires a bootstrap stack`);
  if (existsSync(join(outDir, `${name}.assets.json`))) problems.push(`${name}: contains assets`);
  console.log("");
}

type Metadata = Record<string, Array<{ type: string; data: unknown }>>;
const warnings = Object.entries(manifest.artifacts)
  .filter(([, a]) => a.type === "aws:cloudformation:stack")
  .flatMap(([name]) => {
    const file = join(outDir, `${name}.metadata.json`);
    return existsSync(file) ? Object.values(JSON.parse(readFileSync(file, "utf8")) as Metadata).flat() : [];
  })
  .filter((m) => m.type === "aws:cdk:warning")
  .map((m) => String(m.data));

type ValidationReport = {
  pluginReports: Array<{
    pluginName: string;
    conclusion: string;
    violations: unknown[];
    suppressedViolations: Array<{ ruleName: string; acknowledgedId?: string; violatingConstructs: Array<{ constructPath: string }> }>;
  }>;
};
const reportFile = join(outDir, "validation-report.json");
if (!existsSync(reportFile)) problems.push("validation-report.json missing: cdk-nag did not run");
else {
  const report = JSON.parse(readFileSync(reportFile, "utf8")) as ValidationReport;
  for (const plugin of report.pluginReports) {
    console.log(`${plugin.pluginName}: ${plugin.conclusion}, ${plugin.violations.length} open violation(s)`);
    if (plugin.conclusion !== "success" || plugin.violations.length > 0) problems.push(`${plugin.pluginName} reported violations`);
    for (const v of plugin.suppressedViolations) {
      console.log(`  acknowledged ${v.ruleName} on ${v.violatingConstructs.map((c) => c.constructPath).join(", ")}`);
    }
  }
  console.log("  (reasons for each acknowledgment: src/nag-suppressions.ts)\n");
}

if (warnings.length > 0) {
  console.log("Deploy-time inputs still missing:");
  for (const w of new Set(warnings)) console.log(`  - ${w}`);
  console.log("");
}

if (problems.length > 0) {
  console.error("Plan checks FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("Checks: cdk-nag (AwsSolutions) and CloudFormation schema validation passed during synth;");
console.log("        no assets, no bootstrap roles, no bootstrap version requirement.");
console.log("\nNothing was deployed. No AWS API calls were made by this command.");
