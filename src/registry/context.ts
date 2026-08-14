import type {
  CatalogProduct,
  CatalogVariant,
  CatalogVariantRow,
  VariantColumnCellContext,
} from "./types";

/**
 * Normalize a raw variant into the `{ id, sku, title, thumbnail }` shape cells
 * rely on. Missing ids become `""`; missing sku/title/thumbnail become `null`.
 */
export function normalizeVariant(variant?: Partial<CatalogVariant> | null): CatalogVariant {
  return {
    id: variant?.id ?? "",
    sku: variant?.sku ?? null,
    thumbnail: variant?.thumbnail ?? null,
    title: variant?.title ?? null,
  };
}

/**
 * Extract every non-empty SKU across a list of variants, de-duplicated and in
 * order. Pure and exported so contributors (and tests) can reuse it directly,
 * e.g. to batch a lookup across a page of rows.
 */
export function extractSkus(variants?: Partial<CatalogVariant>[] | null): string[] {
  if (!variants) {
    return [];
  }

  const seen = new Set<string>();
  const skus: string[] = [];
  for (const variant of variants) {
    const sku = variant?.sku;
    if (typeof sku === "string" && sku.length > 0 && !seen.has(sku)) {
      seen.add(sku);
      skus.push(sku);
    }
  }
  return skus;
}

/**
 * Shape a variant row from `GET /admin/product-variants` into the typed
 * {@link VariantColumnCellContext} handed to every column cell.
 *
 * This is the single place normalization happens, so a cell can trust
 * `ctx.variant` / `ctx.sku` / `ctx.product` without re-deriving them. Pure - no
 * admin runtime required.
 *
 * The deprecated product-shaped fields (`variants`, `skus`, `firstSku`,
 * `variantCount`) are filled from this one variant, so a column written before
 * the table listed variants keeps rendering, and renders the right thing: its
 * SKU lookup now hits exactly this row's SKU.
 */
export function buildVariantColumnContext<TProduct extends CatalogProduct>(
  row: CatalogVariantRow<TProduct>,
): VariantColumnCellContext<TProduct> {
  const variant = normalizeVariant(row);
  const product = row.product ?? null;

  return {
    firstSku: variant.sku,
    product,
    productId: product?.id ?? null,
    sku: variant.sku,
    skus: variant.sku ? [variant.sku] : [],
    variant,
    variantCount: 1,
    variantId: variant.id,
    variants: [variant],
  };
}
