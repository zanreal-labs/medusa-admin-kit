/**
 * Emit the package's ESM entry: `.medusa/server/src/index.mjs`.
 *
 * ## Why this exists
 *
 * `medusa plugin:build` compiles `src/**` with `tsc` using the root
 * `tsconfig.json` (`module: Node16`). Since this package is not
 * `"type": "module"`, that produces **CommonJS** at
 * `.medusa/server/src/index.js` - a file whose public API is a pile of
 * `Object.defineProperty(exports, ...)` calls, with no ESM export statements.
 *
 * That is fine for the Medusa server, which `require()`s it. It is not fine for
 * a sibling plugin's **admin** bundle. `plugin:build` externalizes every
 * declared dependency, so a contributor's built
 * `.medusa/server/src/admin/index.mjs` keeps a bare
 * `import { registerProductColumn } from "@zanreal/medusa-admin-kit"`. The host
 * app's admin build (`medusa build` -> vite) has no `rollupOptions.external`, so
 * it must pull that import into the bundle - and vite's default
 * `build.commonjsOptions.include` is `[/node_modules/]`. When the kit is
 * consumed as a workspace package or a git submodule, rollup resolves through
 * the symlink to a real path **outside** `node_modules`, so
 * `@rollup/plugin-commonjs` never runs on it, rollup parses the CJS entry as
 * ESM, finds no named exports, and the whole admin build dies with:
 *
 *     "registerProductColumn" is not exported by
 *     ".../medusa-admin-kit/.medusa/server/src/index.js"
 *
 * Shipping a real ESM entry removes the dependency on that interop rescue
 * entirely: the importer gets statically analyzable `export { ... }` bindings no
 * matter where the package sits on disk or which bundler reads it.
 *
 * ## Why a single bundled file is safe here
 *
 * The output is one self-contained module (everything under `src/registry/` is
 * inlined; the only cross-package imports in that tree are `import type` of
 * React's `ReactNode`, which erase at compile time). So this ESM entry is a
 * *second copy* of the registry code alongside the CJS one - as is the copy that
 * `plugin:build` already inlines into this package's own admin bundle.
 *
 * That is harmless by construction: the registry keeps no module-level state.
 * Its store lives on `globalThis` under
 * `Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1")`, so every
 * copy - CJS, ESM, or inlined - reads and writes the same object. There is no
 * way for a contributor and the kit to end up with separate registries.
 * `src/__tests__/built-entry.test.ts` asserts exactly that against the real
 * build output.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(packageRoot, ".medusa", "server", "src");

await build({
  build: {
    // `medusa plugin:build` has already written the tsc output and the admin
    // bundle here. This step only adds one file to that directory.
    emptyOutDir: false,
    lib: {
      entry: path.join(packageRoot, "src", "index.ts"),
      fileName: () => "index.mjs",
      formats: ["es"],
    },
    minify: false,
    outDir,
    rollupOptions: {
      output: { exports: "named" },
    },
    // The tsc output next to it is CommonJS on purpose; do not let vite report
    // that as a problem when it scans a non-empty outDir.
    reportCompressedSize: false,
    target: "es2021",
  },
  // Never pick up vitest.config.mts (or any other config) from the package root.
  configFile: false,
  logLevel: "warn",
  root: packageRoot,
});
