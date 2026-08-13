import type { ProductColumnDef, ProductColumnProduct } from "./types";

/**
 * Cross-plugin product column registry.
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
 * ## Evaluation order
 *
 * Registration happens at the top level of a contributor's admin module (a
 * widget is the canonical spot - see the README), which runs when the plugin
 * bundle is evaluated, i.e. at admin boot. The kit's own products route reads
 * the registry only when it renders, which requires navigation and therefore
 * happens strictly after boot. So by the time the table asks for columns, every
 * contributor has already registered.
 */

const STORE_KEY = Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1");

interface RegistryStore {
  version: 1;
  columns: Map<string, ProductColumnDef>;
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
 * Register a column in the shared products table.
 *
 * Call this at the top level of an admin module that the dashboard evaluates at
 * boot (a widget is the canonical spot; see the README's contributor contract).
 * Registering twice with the same {@link ProductColumnDef.id} replaces the
 * earlier definition - last registration wins - which also makes HMR a no-op
 * rather than a duplicate.
 *
 * @throws {TypeError} If `id` is not a non-empty string or `cell` is not a function.
 */
export function registerProductColumn<TProduct extends ProductColumnProduct = ProductColumnProduct>(
  def: ProductColumnDef<TProduct>,
): void {
  // These run in the admin (browser) bundle, not an API route, so a plain
  // TypeError is the right signal for a programming mistake by a contributor.
  // MedusaError is a server construct that maps to an HTTP status and pulls in
  // server-only code, which has no place here.
  if (typeof def?.id !== "string" || def.id.length === 0) {
    // eslint-disable-next-line @medusajs/use-medusa-error-not-generic-error
    throw new TypeError("registerProductColumn: `id` must be a non-empty string.");
  }
  if (typeof def.cell !== "function") {
    // eslint-disable-next-line @medusajs/use-medusa-error-not-generic-error
    throw new TypeError(
      `registerProductColumn: column "${def.id}" must provide a \`cell\` function.`,
    );
  }
  getStore().columns.set(def.id, def as unknown as ProductColumnDef);
}

/**
 * Return every registered column, ordered by ascending
 * {@link ProductColumnDef.priority} (lower first, ties keep registration order).
 * The returned array is a fresh copy - mutating it does not affect the registry.
 */
export function getRegisteredProductColumns(): ProductColumnDef[] {
  // `toSorted` returns a fresh, ordered copy, so the store is never mutated.
  return [...getStore().columns.values()].toSorted((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

/** Whether a column with the given id is registered. */
export function hasProductColumn(id: string): boolean {
  return getStore().columns.has(id);
}

/** Return a single registered column by id, or `undefined`. */
export function getProductColumn(id: string): ProductColumnDef | undefined {
  return getStore().columns.get(id);
}

/**
 * Remove a registered column by id. Returns `true` if a column was removed.
 * Mostly useful in tests and for plugins that toggle a column at runtime.
 */
export function unregisterProductColumn(id: string): boolean {
  return getStore().columns.delete(id);
}

/**
 * Remove every registered column. Intended for test isolation and HMR resets;
 * production code should not need it.
 */
export function clearProductColumns(): void {
  getStore().columns.clear();
}
