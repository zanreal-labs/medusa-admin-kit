import type { ReactNode } from "react";
import { buildVariantColumnContext } from "./context";
import type {
  CatalogProduct,
  CatalogVariantRow,
  VariantColumnAsyncState,
  VariantColumnDef,
} from "./types";

/**
 * The kit's own base columns, in render order. They always come first; every
 * registered column is appended after them. Kept as a plain, ordered id list so
 * the final column order is a pure value the route builds from and tests assert
 * against, rather than something buried in JSX.
 *
 * One row is one variant, so:
 *
 * - `sku` is that variant's SKU, not a "2 variants - SKU-1" summary of the
 *   product's variants. There is nothing left to summarize.
 * - there is no `handle` column. A URL slug is not something you scan a
 *   catalogue by, it is a property of the parent product, and it was pure
 *   width; the product cell carries the product's identity instead.
 *
 * `price` and `srp` are base columns rather than contributed ones because both
 * are core Medusa data the kit already has in hand: the shop price is the
 * variant's own price set and the SRP is its own `metadata.srp`. Routing either
 * through the registry would mean a plugin re-fetching, per row, something that
 * arrived with the row. They sit last so the money columns form one contiguous
 * block with the price columns contributors add after them.
 */
export const BASE_CATALOG_COLUMN_IDS = [
  "thumbnail",
  "product",
  "variant",
  "sku",
  "status",
  "price",
  "srp",
] as const;

export type BaseCatalogColumnId = (typeof BASE_CATALOG_COLUMN_IDS)[number];

/**
 * A resolved entry in the Catalog table: either one of the kit's base columns
 * (identified only by id, since the route knows how to render each) or a
 * contributed column (carrying its {@link VariantColumnDef}).
 */
export type ResolvedCatalogColumn<TProduct extends CatalogProduct = CatalogProduct> =
  | { id: BaseCatalogColumnId; source: "base" }
  | { id: string; source: "registered"; def: VariantColumnDef<TProduct> };

/**
 * Merge the base columns with the registered ones into the final, ordered list
 * the table renders: base columns first (in {@link BASE_CATALOG_COLUMN_IDS}
 * order), then the registered columns in the exact order they are passed in
 * (the registry already sorts them by priority).
 *
 * Pure and framework-free so the ordering contract can be unit-tested without a
 * dashboard. The route maps each entry to a `@medusajs/ui` column.
 */
export function resolveCatalogColumns<TProduct extends CatalogProduct>(
  registered: VariantColumnDef<TProduct>[],
): ResolvedCatalogColumn<TProduct>[] {
  const base = BASE_CATALOG_COLUMN_IDS.map(
    (id): ResolvedCatalogColumn<TProduct> => ({ id, source: "base" }),
  );
  const contributed = registered.map(
    (def): ResolvedCatalogColumn<TProduct> => ({ def, id: def.id, source: "registered" }),
  );
  return [...base, ...contributed];
}

/**
 * Render a registered column's cell for a single variant row: build the typed
 * {@link buildVariantColumnContext} and hand it to the column's `cell`. This is
 * the sync half of what the route does per row (the route itself wraps this
 * with the async-fetch lifecycle for columns that set `loadData` - see
 * `RegisteredVariantCell` under `src/admin/`), extracted so the wiring, and a
 * column's loading/data/error render branches, can be asserted in Node without
 * a React renderer: pass `async` directly to exercise a given state.
 */
export function renderRegisteredCell<TProduct extends CatalogProduct, TData = unknown>(
  def: VariantColumnDef<TProduct, TData>,
  row: CatalogVariantRow<TProduct>,
  async?: VariantColumnAsyncState<TData>,
): ReactNode {
  return def.cell(buildVariantColumnContext(row), async);
}
