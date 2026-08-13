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
 * The state of a column's optional {@link ProductColumnDef.loadData} fetch for
 * one row, handed to `cell` as its second argument.
 *
 * A column with no `loadData` never receives this - `cell` is called with just
 * `ctx`, exactly as before. A column that declares `loadData` gets `cell`
 * called again on every state transition (`isLoading: true` first, then either
 * `data` or `error` once the fetch settles), so it can render a skeleton, then
 * the real value or an inline error - the base table never awaits the fetch.
 */
export interface ProductColumnAsyncState<TData = unknown> {
  /** The resolved value once `loadData` succeeds. `undefined` until then. */
  data: TData | undefined;
  /** Whether `loadData` is currently in flight for this row. */
  isLoading: boolean;
  /** The error `loadData` rejected with, if any. `null` while loading or on success. */
  error: unknown;
}

/**
 * A column contributed to the extensible products table.
 *
 * Register one with {@link registerProductColumn}. The kit's own base columns
 * (title, handle, status, thumbnail, variant/SKU summary) always render first;
 * registered columns are appended after them, ordered by {@link priority}.
 *
 * @typeParam TProduct - The product row type. See {@link ProductColumnCellContext}.
 * @typeParam TData - The value {@link loadData} resolves to, for a column that
 * needs a network round trip (e.g. an Allegro offer-status lookup, or a
 * product-costs margin lookup). Unused, and safely defaulted, by columns that
 * derive everything from `ctx` and never set `loadData`.
 */
export interface ProductColumnDef<
  TProduct extends ProductColumnProduct = ProductColumnProduct,
  TData = unknown,
> {
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
  /**
   * Renders the cell for a given product row.
   *
   * For a synchronous column (no `loadData`), `async` is always `undefined` -
   * derive the cell entirely from `ctx`. For a column that also sets
   * `loadData`, this is called again on every async state change; check
   * `async.isLoading` / `async.data` / `async.error` to render a skeleton, the
   * resolved value, or an inline error. A `cell` that throws degrades to an
   * inline error for that one cell - it does not take down the row, the
   * table, or any other plugin's column.
   */
  cell: (
    ctx: ProductColumnCellContext<TProduct>,
    async?: ProductColumnAsyncState<TData>,
  ) => ReactNode;
  /**
   * Optional async loader for a cell backed by a network call. Runs once per
   * row, after the table has already rendered that row with `async.isLoading:
   * true` - it never blocks or delays the base table's own render or loading
   * state. Re-runs when the row's context identity changes (a new product
   * object from a fresh page/search fetch).
   *
   * Aggregate variant-level data to the product level here if needed (e.g. "3
   * offers / 1 conflict" from `ctx.skus`), not in `cell` - `cell` should stay
   * a pure render of whatever `loadData` already resolved.
   */
  loadData?: (ctx: ProductColumnCellContext<TProduct>) => Promise<TData>;
}
