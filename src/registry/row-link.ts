import type { CatalogProduct, CatalogVariantRow } from "./types";

/**
 * Where a Catalog row click goes.
 *
 * A row is a variant, so it links to that variant's own detail page, which the
 * stock admin already owns at `/products/:id/variants/:variant_id`. The stock
 * dashboard's product detail page links its own variant table rows to exactly
 * this path (`rowHref={(row) => `/products/${product.id}/variants/${row.id}`}`
 * in `product-variant-section.tsx`), so the Catalog lands the user on the same
 * screen the rest of the admin would, and the breadcrumb there walks back up to
 * the product. Linking to the product instead would drop the one thing the row
 * identified.
 *
 * The path is router-relative on purpose: the admin's router is mounted under
 * the dashboard base path, so `navigate("/products/...")` resolves correctly
 * without this helper having to know what that base is.
 *
 * Returns `null` when the row cannot address a variant page (no parent product
 * on the row, or no variant id), so the caller can skip navigation rather than
 * push a broken URL.
 */
export function variantDetailHref(row: CatalogVariantRow<CatalogProduct>): string | null {
  const productId = row.product?.id;
  if (!productId || !row.id) {
    return null;
  }
  return `/products/${productId}/variants/${row.id}`;
}

/**
 * Unwrap whatever `@medusajs/ui`'s `DataTable` hands an `onRowClick` handler.
 *
 * `useDataTable` types the second argument as `TData`, but at 4.2.0 the table
 * actually calls it with TanStack's `Row<TData>` wrapper
 * (`instance.onRowClick?.(e, row)` inside `data-table-table.tsx`, where `row`
 * comes straight from `getRowModel().rows`). Reading `row.original` blind would
 * break if that is ever corrected to match the types, and reading the row blind
 * breaks today. So probe for the wrapper and accept both.
 */
export function unwrapClickedRow<TRow>(clicked: TRow | { original: TRow }): TRow {
  if (clicked && typeof clicked === "object" && "original" in clicked) {
    return (clicked as { original: TRow }).original;
  }
  return clicked as TRow;
}
