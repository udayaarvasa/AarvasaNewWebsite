#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { buildMediaApp } from "../src/app";

// Synthesizes CloudFormation only. There is intentionally no deploy script in
// this repository; see infra/README.md "How deployment will eventually work".
const app = new App();
buildMediaApp(app, process.env);
app.synth();
