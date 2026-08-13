import type { ReactNode } from "react";

/**
 * A single product variant, reduced to the fields a column cell is likely to
 * key on. Kept structural (not tied to `@medusajs/types`) so the registry and
 * its pure helpers can be imported and unit-tested without the admin runtime.
 */
export interface ProductColumnVariant {
  id: string;
  sku: string | null;
  title: string | null;
}

/**
 * The minimal shape of an admin product a cell needs. `@medusajs/types`'
 * `HttpTypes.AdminProduct` is structurally assignable to this, so contributors
 * can pass the real product straight through and keep it typed as `AdminProduct`
 * via the `TProduct` generic on {@link ProductColumnCellContext}.
 */
export interface ProductColumnProduct {
  id: string;
  title?: string | null;
  handle?: string | null;
  status?: string | null;
  thumbnail?: string | null;
  variants?: Partial<ProductColumnVariant>[] | null;
}

/**
 * The typed context handed to every column cell. Built once per product row by
 * {@link buildProductColumnContext}, so a contributor never has to re-derive
 * the SKU list or variant count themselves.
 *
 * @typeParam TProduct - The product row type. Defaults to the structural
 * {@link ProductColumnProduct}; pass `HttpTypes.AdminProduct` for the full type.
 */
export interface ProductColumnCellContext<
  TProduct extends ProductColumnProduct = ProductColumnProduct,
> {
  /** The product row exactly as returned by the products API. */
  product: TProduct;
  /** The product's variants, normalized to `{ id, sku, title }`. */
  variants: ProductColumnVariant[];
  /** Every non-empty SKU across the variants, de-duplicated, in order. */
  skus: string[];
  /** The first non-empty SKU, or `null` when the product has none. */
  firstSku: string | null;
  /** The number of variants on the product. */
  variantCount: number;
}

/**
 * A column contributed to the extensible products table.
 *
 * Register one with {@link registerProductColumn}. The kit's own base columns
 * (title, handle, status, thumbnail, variant/SKU summary) always render first;
 * registered columns are appended after them, ordered by {@link priority}.
 */
export interface ProductColumnDef<TProduct extends ProductColumnProduct = ProductColumnProduct> {
  /**
   * A stable, unique id. Namespace it to your plugin to avoid collisions with
   * other contributors, e.g. `"allegro.sync_status"` or `"product-costs.margin"`.
   * Registering twice with the same id replaces the earlier definition.
   */
  id: string;
  /** Column header. A plain string, or a render function for a custom header. */
  header: string | (() => ReactNode);
  /**
   * Sort key among registered columns. Lower renders first (think CSS `order`).
   * Ties keep registration order. Defaults to `0`.
   */
  priority?: number;
  /** Renders the cell for a given product row. */
  cell: (ctx: ProductColumnCellContext<TProduct>) => ReactNode;
}
