import { readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { buildMediaApp, type MediaApp } from "../src/app";

type Json = Record<string, unknown>;

/** The same feature flags the CLI reads from cdk.json, so tests synthesize identically. */
function cdkJsonContext(): Record<string, unknown> {
  const cdkJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "cdk.json"), "utf8")) as { context: Json };
  return cdkJson.context;
}

export interface SynthesizedMediaApp extends MediaApp {
  readonly app: App;
  readonly templates: { readonly edge: Template; readonly storage: Template; readonly monitoring: Template; readonly processing: Template };
}

/** Builds and synthesizes the app offline. cdk-nag and CloudFormation schema validation run as part of synth. */
export function synthMediaApp(context: Record<string, string> = {}, env: NodeJS.ProcessEnv = {}): SynthesizedMediaApp {
  const app = new App({ context: { ...cdkJsonContext(), ...context } });
  const built = buildMediaApp(app, env);
  return {
    ...built,
    app,
    templates: {
      edge: Template.fromStack(built.edge),
      storage: Template.fromStack(built.storage),
      monitoring: Template.fromStack(built.monitoring),
      processing: Template.fromStack(built.processing),
    },
  };
}

export type PolicyStatementJson = {
  Sid?: string;
  Effect: "Allow" | "Deny";
  Principal?: unknown;
  Action?: string | string[];
  Resource?: unknown;
  NotResource?: unknown;
  Condition?: Json;
};

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Flattens Fn::Join / Fn::GetAtt tokens into a readable string for prefix assertions. */
export function renderToken(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Json;
    if ("Fn::Join" in obj) {
      const [sep, parts] = obj["Fn::Join"] as [string, unknown[]];
      return parts.map(renderToken).join(sep);
    }
    if ("Fn::GetAtt" in obj) return `<${(obj["Fn::GetAtt"] as string[]).join(".")}>`;
    if ("Ref" in obj) return `<${obj.Ref as string}>`;
  }
  return JSON.stringify(value);
}

export function resourcesOfType(template: Template, type: string): Array<{ id: string; properties: Json }> {
  return Object.entries(template.findResources(type)).map(([id, r]) => ({
    id,
    properties: (r as { Properties: Json }).Properties,
  }));
}
