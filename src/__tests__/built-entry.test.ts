import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Guards the package's *built* export surface, which is a different thing from
 * the source surface every other test in this repo covers.
 *
 * ## The regression this exists to catch
 *
 * A contributor plugin's admin widget does:
 *
 * ```ts
 * import { registerProductColumn } from "@zanreal/medusa-admin-kit"
 * ```
 *
 * `medusa plugin:build` externalizes declared dependencies, so that bare import
 * survives into the contributor's built `.medusa/server/src/admin/index.mjs`.
 * The *host* app's admin build (`medusa build` -> vite) then has to pull it into
 * the bundle, because that build declares no `rollupOptions.external`.
 *
 * `medusa plugin:build` compiles this package with `tsc` to **CommonJS**. When
 * the kit was only shipped as that CJS file, the host build worked or failed
 * purely on where the package happened to sit on disk: vite's default
 * `build.commonjsOptions.include` is `[/node_modules/]`, so a plain npm/git
 * install got CJS-to-ESM interop and a workspace package or git submodule
 * (resolved through a symlink to a real path outside `node_modules`) did not.
 * In the second case rollup parsed the CJS entry as ESM, found no named
 * exports, and killed the entire admin build with:
 *
 *     "registerProductColumn" is not exported by ".../src/index.js"
 *
 * Every repo still passed its own tests in isolation, which is why this only
 * surfaced when the three packages were assembled. These assertions run against
 * the real build output so the packaging half cannot silently regress.
 *
 * Requires `pnpm build` to have run. It always has in practice: `prepare` builds
 * on install, and CI builds before it tests.
 */

/** The runtime bindings a contributor plugin is allowed to import by name. */
const PUBLIC_EXPORTS = [
  "BASE_CATALOG_COLUMN_IDS",
  "DEFAULT_PAGE_SIZE",
  "PAGE_SIZE_OPTIONS",
  "SRP_METADATA_KEY",
  "VARIANT_LIST_FIELDS",
  "buildVariantColumnContext",
  "buildVariantListQuery",
  "clearVariantColumns",
  "extractSkus",
  "formatAmount",
  "readAmount",
  "readVariantSrp",
  "selectVariantPrice",
  "getRegisteredVariantColumns",
  "getVariantColumn",
  "hasVariantColumn",
  "mapVariantListResponse",
  "normalizeVariant",
  "pageCount",
  "registerVariantColumn",
  "renderRegisteredCell",
  "resolveCatalogColumns",
  "unregisterVariantColumn",
  "unwrapClickedRow",
  "variantDetailHref",
  // The deprecated product-named registration aliases are part of the shipped
  // surface too: an unmigrated contributor's built bundle still imports these
  // by name, and rollup fails the whole host admin build if they are missing.
  "clearProductColumns",
  "getProductColumn",
  "getRegisteredProductColumns",
  "hasProductColumn",
  "registerProductColumn",
  "unregisterProductColumn",
] as const;

const packageRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as {
  exports: Record<string, Record<string, string>>;
  types?: string;
};

const rootExport = packageJson.exports["."];
const esmEntry = path.join(packageRoot, rootExport.import);
const cjsEntry = path.join(packageRoot, rootExport.require);

function requireBuilt(): boolean {
  if (existsSync(esmEntry) && existsSync(cjsEntry)) {
    return true;
  }
  throw new Error(
    `Build output missing. Run \`pnpm build\` before \`pnpm test\` (expected ${esmEntry}).`,
  );
}

describe("built package entry", () => {
  it("maps the `import` condition to an ESM file and `require` to the CommonJS one", () => {
    // The whole bug was an `import` condition pointing at a CommonJS file.
    expect(rootExport.import).toBe("./.medusa/server/src/index.mjs");
    expect(rootExport.require).toBe("./.medusa/server/src/index.js");
    expect(rootExport.types).toBe("./.medusa/server/src/index.d.ts");
    expect(requireBuilt()).toBe(true);
  });

  it("exposes every public binding as a static ESM named export", () => {
    requireBuilt();
    const source = readFileSync(esmEntry, "utf8");

    // A statically analyzable `export { ... }` is precisely what rollup needs
    // and what the CommonJS entry cannot give it. Assert on the source, not
    // just on a runtime namespace, because Node's CJS lexer would happily
    // synthesize named exports for a CommonJS file and hide the regression.
    expect(source).toMatch(/^export \{/m);
    expect(source).not.toMatch(/\bexports\.[A-Za-z_]/);
    expect(source).not.toMatch(/\brequire\(/);

    for (const name of PUBLIC_EXPORTS) {
      expect(source, `${name} missing from the built ESM entry`).toContain(name);
    }
  });

  it("resolves every public binding at runtime from both built entries", async () => {
    requireBuilt();
    const esm = (await import(pathToFileURL(esmEntry).href)) as Record<string, unknown>;
    const cjs = createRequire(path.join(packageRoot, "package.json"))(cjsEntry) as Record<
      string,
      unknown
    >;

    for (const name of PUBLIC_EXPORTS) {
      expect(esm[name], `${name} missing from ${esmEntry}`).toBeDefined();
      expect(cjs[name], `${name} missing from ${cjsEntry}`).toBeDefined();
    }
  });

  it(
    "survives a bundler with no CommonJS interop, the way the host admin build reads it",
    async () => {
      requireBuilt();

      // Reproduces the failing host build in miniature: a module outside
      // `node_modules` re-exports the kit's bindings by name, and rollup runs
      // with `commonjsOptions.include: []` so no CJS-to-ESM interop can rescue
      // a CommonJS entry. Re-exports (rather than a bare import) keep rollup
      // from tree-shaking the bindings away before it checks them.
      // Imported dynamically: this file compiles to CommonJS, and vite's CJS
      // type entry is a deprecation stub typed `any`. The ESM types are real.
      const { build } = await import("vite");

      const scratch = mkdtempSync(path.join(tmpdir(), "admin-kit-entry-"));
      const entry = path.join(scratch, "importer.mjs");
      writeFileSync(
        entry,
        `export { ${PUBLIC_EXPORTS.join(", ")} } from ${JSON.stringify(esmEntry)};\n`,
      );

      await expect(
        build({
          build: {
            commonjsOptions: { include: [] },
            lib: { entry, fileName: () => "bundle.mjs", formats: ["es"] },
            minify: false,
            write: false,
          },
          configFile: false,
          logLevel: "silent",
          root: scratch,
        }),
      ).resolves.toBeDefined();
    },
    60_000,
  );
});

describe("built entries share one registry", () => {
  afterAll(async () => {
    const esm = (await import(pathToFileURL(esmEntry).href)) as {
      clearVariantColumns: () => void;
    };
    esm.clearVariantColumns();
  });

  it("registers through the ESM copy and reads it back through the CommonJS copy", async () => {
    requireBuilt();

    // The ESM entry is a second, independently bundled copy of the registry
    // code (as is the copy `plugin:build` inlines into this package's own admin
    // bundle). That is only safe because the store is anchored on `globalThis`
    // under a versioned `Symbol.for` key rather than held in module scope. If
    // anyone ever moves the store into a module-level variable, the copies
    // split, a contributor's column vanishes from the table, and this fails.
    const esm = (await import(pathToFileURL(esmEntry).href)) as {
      clearVariantColumns: () => void;
      registerVariantColumn: (def: {
        id: string;
        header: string;
        cell: () => string;
      }) => void;
      registerProductColumn: (def: {
        id: string;
        header: string;
        cell: () => string;
      }) => void;
    };
    const cjs = createRequire(path.join(packageRoot, "package.json"))(cjsEntry) as {
      getRegisteredVariantColumns: () => { id: string }[];
      hasVariantColumn: (id: string) => boolean;
      hasProductColumn: (id: string) => boolean;
    };

    esm.clearVariantColumns();
    esm.registerVariantColumn({
      cell: () => "ok",
      header: "Dual entry",
      id: "test.dual-entry",
    });

    expect(cjs.hasVariantColumn("test.dual-entry")).toBe(true);
    expect(cjs.getRegisteredVariantColumns().map((column) => column.id)).toContain(
      "test.dual-entry",
    );

    // The deprecated alias in one built copy must reach the same store the
    // other copy reads, or an unmigrated contributor loses its column.
    esm.registerProductColumn({
      cell: () => "ok",
      header: "Legacy alias",
      id: "test.dual-entry-legacy",
    });
    expect(cjs.hasProductColumn("test.dual-entry-legacy")).toBe(true);
    expect(cjs.hasVariantColumn("test.dual-entry-legacy")).toBe(true);
  });
});
