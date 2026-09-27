#!/usr/bin/env bash
#
# Package the one-time migration runner.
#
# Carries the Prisma CLI and the two linux-arm64 engines (query and schema) —
# `migrate deploy` needs the schema engine, which the client bundle does not
# include. The developer's darwin engines are excluded: they are ~35 MB of
# payload that can never run on Lambda.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/infra/migration-runner/build"
ZIP="$ROOT/infra/dist/migration-runner.zip"
rm -rf "$OUT"; mkdir -p "$OUT/node_modules" "$(dirname "$ZIP")"

cp "$ROOT/infra/migration-runner/index.mjs" "$OUT/"
cp -R "$ROOT/prisma" "$OUT/prisma"

for pkg in prisma @prisma/engines @prisma/engines-version @prisma/debug @prisma/get-platform @prisma/fetch-engine @prisma/generator-helper @prisma/internals; do
  [ -d "$ROOT/node_modules/$pkg" ] || continue
  mkdir -p "$OUT/node_modules/$(dirname "$pkg")"
  cp -R "$ROOT/node_modules/$pkg" "$OUT/node_modules/$pkg"
done

# Only the engines this runtime can execute.
find "$OUT/node_modules" \( -name '*darwin*' -o -name '*windows*' -o -name '*debian*' -o -name '*rhel*' \) -delete 2>/dev/null || true

rm -f "$ZIP"; (cd "$OUT" && zip -qr "$ZIP" .)
echo "✓ $ZIP ($(du -h "$ZIP" | cut -f1))"
