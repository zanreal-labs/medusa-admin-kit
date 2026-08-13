import type { ProductColumnCellContext, ProductColumnProduct, ProductColumnVariant } from "./types";

/**
 * Normalize a raw variant into the `{ id, sku, title }` shape cells rely on.
 * Missing ids become `""`; missing sku/title become `null`.
 */
export function normalizeVariant(
  variant?: Partial<ProductColumnVariant> | null,
): ProductColumnVariant {
  return {
    id: variant?.id ?? "",
    sku: variant?.sku ?? null,
    title: variant?.title ?? null,
  };
}

/**
 * Extract every non-empty SKU across a product's variants, de-duplicated and in
 * order. Pure and exported so contributors (and tests) can reuse it directly.
 */
export function extractSkus(variants?: Partial<ProductColumnVariant>[] | null): string[] {
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
 * Shape a product row from the admin products API into the typed
 * {@link ProductColumnCellContext} handed to every column cell.
 *
 * This is the single place SKU extraction and variant normalization happen, so a
 * cell can trust `ctx.skus` / `ctx.firstSku` / `ctx.variantCount` without
 * re-deriving them. Pure - no admin runtime required.
 */
export function buildProductColumnContext<TProduct extends ProductColumnProduct>(
  product: TProduct,
): ProductColumnCellContext<TProduct> {
  const rawVariants = product.variants ?? [];
  const variants = rawVariants.map(normalizeVariant);
  const skus = extractSkus(rawVariants);

  return {
    firstSku: skus[0] ?? null,
    product,
    skus,
    variantCount: variants.length,
    variants,
  };
}
