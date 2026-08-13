import type { ReactNode } from "react";
import { buildProductColumnContext } from "./context";
import type { ProductColumnDef, ProductColumnProduct } from "./types";

/**
 * The kit's own base columns, in render order. They always come first; every
 * registered column is appended after them. Kept as a plain, ordered id list so
 * the final column order is a pure value the route builds from and tests assert
 * against, rather than something buried in JSX.
 */
export const BASE_PRODUCT_COLUMN_IDS = [
  "thumbnail",
  "title",
  "handle",
  "status",
  "sku_summary",
] as const;

export type BaseProductColumnId = (typeof BASE_PRODUCT_COLUMN_IDS)[number];

/**
 * A resolved entry in the products table: either one of the kit's base columns
 * (identified only by id, since the route knows how to render each) or a
 * contributed column (carrying its {@link ProductColumnDef}).
 */
export type ResolvedProductColumn<TProduct extends ProductColumnProduct = ProductColumnProduct> =
  | { id: BaseProductColumnId; source: "base" }
  | { id: string; source: "registered"; def: ProductColumnDef<TProduct> };

/**
 * Merge the base columns with the registered ones into the final, ordered list
 * the table renders: base columns first (in {@link BASE_PRODUCT_COLUMN_IDS}
 * order), then the registered columns in the exact order they are passed in
 * (the registry already sorts them by priority).
 *
 * Pure and framework-free so the ordering contract can be unit-tested without a
 * dashboard. The route maps each entry to a `@medusajs/ui` column.
 */
export function resolveProductColumns<TProduct extends ProductColumnProduct>(
  registered: ProductColumnDef<TProduct>[],
): ResolvedProductColumn<TProduct>[] {
  const base = BASE_PRODUCT_COLUMN_IDS.map(
    (id): ResolvedProductColumn<TProduct> => ({ id, source: "base" }),
  );
  const contributed = registered.map(
    (def): ResolvedProductColumn<TProduct> => ({ def, id: def.id, source: "registered" }),
  );
  return [...base, ...contributed];
}

/**
 * Render a registered column's cell for a single product row: build the typed
 * {@link buildProductColumnContext} and hand it to the column's `cell`. This is
 * exactly what the route does per row, extracted so the wiring can be tested in
 * Node without a React renderer.
 */
export function renderRegisteredCell<TProduct extends ProductColumnProduct>(
  def: ProductColumnDef<TProduct>,
  product: TProduct,
): ReactNode {
  return def.cell(buildProductColumnContext(product));
}
