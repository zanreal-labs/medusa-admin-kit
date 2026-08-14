import type { CatalogProduct, VariantColumnDef } from "./types";

/**
 * Cross-plugin Catalog column registry.
 *
 * ## Why the state lives on `globalThis`
 *
 * Every contributing plugin (Allegro, product-costs, ...) is built in isolation
 * with `medusa plugin:build`, which bundles its admin extension into a single
 * `index.mjs`. The host admin build then imports each plugin bundle eagerly at
 * boot and hands them to the dashboard. For a registry shared across those
 * bundles to work, all of them must read and write the *same* store.
 *
 * `plugin:build` externalizes anything a plugin lists in its
 * `dependencies` / `peerDependencies` / `devDependencies`, so when a contributor
 * imports `@zanreal/medusa-admin-kit` the reference survives as a bare import and
 * the host resolves it once - a single module instance, one store. That is the
 * happy path. But we do not want correctness to *depend* on every contributor
 * getting their dependency wiring exactly right (a mis-declared or version-split
 * dependency could get inlined, producing a second module instance and a second
 * store). So the store is anchored on `globalThis` under a versioned
 * {@link Symbol.for} key: even if this module is instantiated more than once,
 * every copy converges on the same underlying registry.
 *
 * ## Why the key stays at v1 even though the cell context changed
 *
 * Moving the table from product rows to variant rows reshaped what a `cell`
 * receives, but it did **not** split the registry. A contributor never bundles
 * its own copy of this module: the kit is externalized, so a plugin built
 * against the old API still resolves `registerProductColumn` to the alias
 * below, in the one installed copy of the kit, writing to the one store. Bumping
 * the key would create the split it is meant to prevent - the route reading v2
 * while an unmigrated plugin wrote to v1, and its column silently vanishing.
 * The old-shaped fields on the context (see `VariantColumnCellContext`) are what
 * keep such a column rendering.
 *
 * ## Evaluation order
 *
 * Registration happens at the top level of a contributor's admin module (a
 * widget is the canonical spot - see the README), which runs when the plugin
 * bundle is evaluated, i.e. at admin boot. The kit's own Catalog route reads
 * the registry only when it renders, which requires navigation and therefore
 * happens strictly after boot. So by the time the table asks for columns, every
 * contributor has already registered.
 */

const STORE_KEY = Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1");

interface RegistryStore {
  version: 1;
  columns: Map<string, VariantColumnDef>;
}

function getStore(): RegistryStore {
  const globalScope = globalThis as typeof globalThis & {
    [STORE_KEY]?: RegistryStore;
  };

  let store = globalScope[STORE_KEY];
  if (!store) {
    store = { columns: new Map(), version: 1 };
    globalScope[STORE_KEY] = store;
  }
  return store;
}

/**
 * Register a column in the shared Catalog table.
 *
 * Call this at the top level of an admin module that the dashboard evaluates at
 * boot (a widget is the canonical spot; see the README's contributor contract).
 * Registering twice with the same {@link VariantColumnDef.id} replaces the
 * earlier definition - last registration wins - which also makes HMR a no-op
 * rather than a duplicate.
 *
 * @throws {TypeError} If `id` is not a non-empty string or `cell` is not a function.
 */
export function registerVariantColumn<
  TProduct extends CatalogProduct = CatalogProduct,
  TData = unknown,
>(def: VariantColumnDef<TProduct, TData>): void {
  // These run in the admin (browser) bundle, not an API route, so a plain
  // TypeError is the right signal for a programming mistake by a contributor.
  // MedusaError is a server construct that maps to an HTTP status and pulls in
  // server-only code, which has no place here.
  if (typeof def?.id !== "string" || def.id.length === 0) {
    // eslint-disable-next-line @medusajs/use-medusa-error-not-generic-error
    throw new TypeError("registerVariantColumn: `id` must be a non-empty string.");
  }
  if (typeof def.cell !== "function") {
    // eslint-disable-next-line @medusajs/use-medusa-error-not-generic-error
    throw new TypeError(
      `registerVariantColumn: column "${def.id}" must provide a \`cell\` function.`,
    );
  }
  getStore().columns.set(def.id, def as unknown as VariantColumnDef);
}

/**
 * Return every registered column, ordered by ascending
 * {@link VariantColumnDef.priority} (lower first, ties keep registration order).
 * The returned array is a fresh copy - mutating it does not affect the registry.
 */
export function getRegisteredVariantColumns(): VariantColumnDef[] {
  // `toSorted` returns a fresh, ordered copy, so the store is never mutated.
  return [...getStore().columns.values()].toSorted((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/** Whether a column with the given id is registered. */
export function hasVariantColumn(id: string): boolean {
  return getStore().columns.has(id);
}

/** Return a single registered column by id, or `undefined`. */
export function getVariantColumn(id: string): VariantColumnDef | undefined {
  return getStore().columns.get(id);
}

/**
 * Remove a registered column by id. Returns `true` if a column was removed.
 * Mostly useful in tests and for plugins that toggle a column at runtime.
 */
export function unregisterVariantColumn(id: string): boolean {
  return getStore().columns.delete(id);
}

/**
 * Remove every registered column. Intended for test isolation and HMR resets;
 * production code should not need it.
 */
export function clearVariantColumns(): void {
  getStore().columns.clear();
}

/**
 * @deprecated Renamed to {@link registerVariantColumn}. The Catalog lists one
 * variant per row, so this is no longer a product column registry. The alias
 * still writes to the same store, and the cell context still carries the old
 * product-shaped fields (scoped to the row's single variant), so an unmigrated
 * column keeps rendering. See the README's "Migrating from product rows".
 */
export const registerProductColumn = registerVariantColumn;

/** @deprecated Renamed to {@link getRegisteredVariantColumns}. */
export const getRegisteredProductColumns = getRegisteredVariantColumns;

/** @deprecated Renamed to {@link hasVariantColumn}. */
export const hasProductColumn = hasVariantColumn;

/** @deprecated Renamed to {@link getVariantColumn}. */
export const getProductColumn = getVariantColumn;

/** @deprecated Renamed to {@link unregisterVariantColumn}. */
export const unregisterProductColumn = unregisterVariantColumn;

/** @deprecated Renamed to {@link clearVariantColumns}. */
export const clearProductColumns = clearVariantColumns;
