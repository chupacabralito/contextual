# Releasing Contextual

## Version bump

1. Update `version` in all three package.json files to the same value:
   - `packages/shared/package.json`
   - `packages/react/package.json`
   - `packages/server/package.json`
2. Update the `@contextualapp/shared` dependency range in react and server to match (e.g. `"^0.2.0"`).
3. Update `DEFAULT_PACKAGE_VERSIONS` in `packages/server/src/init.ts` to match the new version.
4. Commit: `Prepare packages for X.Y.Z publish`

## Pre-publish verification

```bash
# Build everything
npm run build:server

# Run all tests
npm run test:server

# Pack and inspect (from repo root)
npm pack --workspace=@contextualapp/shared --dry-run
npm pack --workspace=@contextualapp/react --dry-run
npm pack --workspace=@contextualapp/server --dry-run
```

Verify that `@contextualapp/server` tarball includes `dist/context-manager/` (the bundled UI).

## Clean-app smoke test

```bash
# Create a temp Vite + React app
mkdir -p /tmp/ctx-smoke/app/src
# ... scaffold package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx

# Pack real tarballs
npm pack --workspace=@contextualapp/shared --pack-destination /tmp/ctx-smoke
npm pack --workspace=@contextualapp/react --pack-destination /tmp/ctx-smoke
npm pack --workspace=@contextualapp/server --pack-destination /tmp/ctx-smoke

# Install into the sample app
cd /tmp/ctx-smoke/app
npm install
npm install --no-save /tmp/ctx-smoke/contextual-*.tgz

# Run init
./node_modules/.bin/contextual-server init --project-dir .

# Verify:
#   - .contextual/ created with config.json
#   - package.json has @contextualapp/react and @contextualapp/shared with correct semver
#   - ContextualOverlay component generated

# Start server and dev server
./node_modules/.bin/contextual-server start &
npx vite --port 4173 &

# Check:
#   curl http://localhost:4700/health   -> { "status": "ok", ... }
#   curl http://localhost:4700/         -> 200 text/html (context manager)
#   curl http://localhost:4173/         -> 200 (Vite app boots without errors)
```

## Publish

Publish in dependency order with `--access public` (required for scoped packages on first publish):

```bash
npm publish --workspace=@contextualapp/shared --access public
npm publish --workspace=@contextualapp/react --access public
npm publish --workspace=@contextualapp/server --access public
```

## Post-publish

```bash
# Verify from a clean install
npm install -g @contextualapp/server
contextual-server start --context-root /tmp/test-project
```
