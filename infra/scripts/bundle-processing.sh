#!/usr/bin/env bash
#
# Package the media processing Lambdas (worker + sweeper) for deployment.
#
# The Processing stack loads code with Code.fromBucket, deliberately avoiding
# CDK assets and the bootstrap stack, so the bundle has to exist in the artifact
# bucket before the stack is deployed. This script produces that bundle.
#
# Two things must line up with the stack:
#   - the handlers are "index.workerHandler" and "index.sweeperHandler", so the
#     zip root must contain index.js exporting both;
#   - the functions are Node 24 on ARM64, so Prisma needs its
#     linux-arm64-openssl-3.0.x engine (see binaryTargets in schema.prisma).
#     Bundling only the developer's native engine yields a Lambda that starts
#     and then fails on its first query.
#
# The AWS SDK v3 is provided by the Node 24 runtime and is left external.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/infra/dist-bundle"
ZIP="$ROOT/infra/dist/processing-lambdas.zip"

rm -rf "$OUT"; mkdir -p "$OUT" "$(dirname "$ZIP")"

echo "› bundling handlers"
npx --yes esbuild "$ROOT/infra/src/runtime/handlers.ts" \
  --bundle --platform=node --target=node24 --format=cjs \
  --external:@prisma/client --external:.prisma/client --external:@aws-sdk/* \
  --outfile="$OUT/index.js" \
  --log-level=warning

echo "› adding the Prisma client and its ARM64 engine"
mkdir -p "$OUT/node_modules/.prisma/client" "$OUT/node_modules/@prisma/client"
cp -R "$ROOT/node_modules/@prisma/client/." "$OUT/node_modules/@prisma/client/"
# Only the engine the Lambda actually runs on; the developer's .dylib is dead
# weight in a deployment package.
cp "$ROOT/node_modules/.prisma/client/schema.prisma" "$OUT/node_modules/.prisma/client/"
cp "$ROOT/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-3.0.x.so.node" \
   "$OUT/node_modules/.prisma/client/"
for f in index.js index.d.ts package.json default.js edge.js wasm.js; do
  [ -f "$ROOT/node_modules/.prisma/client/$f" ] && cp "$ROOT/node_modules/.prisma/client/$f" "$OUT/node_modules/.prisma/client/" || true
done

echo "› zipping"
rm -f "$ZIP"
(cd "$OUT" && zip -qr "$ZIP" .)
echo "✓ $ZIP ($(du -h "$ZIP" | cut -f1))"
