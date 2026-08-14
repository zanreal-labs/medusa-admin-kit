import type { ReactNode } from "react";
import type { CatalogPrice } from "./money";

/**
 * A single product variant, reduced to the fields a column cell is likely to
 * key on. Kept structural (not tied to `@medusajs/types`) so the registry and
 * its pure helpers can be imported and unit-tested without the admin runtime.
 */
export interface CatalogVariant {
  id: string;
  sku: string | null;
  title: string | null;
  /** The variant's own image, when it has one. Falls back to the product's. */
  thumbnail: string | null;
}

/**
 * The minimal shape of the parent product a cell needs. `@medusajs/types`'
 * `HttpTypes.AdminProduct` is structurally assignable to this, so contributors
 * can pass the real product straight through and keep it typed as `AdminProduct`
 * via the `TProduct` generic on {@link VariantColumnCellContext}.
 */
export interface CatalogProduct {
  id: string;
  title?: string | null;
  handle?: string | null;
  status?: string | null;
  thumbnail?: string | null;
  /** Where a product-wide SRP lives, when the variant does not carry its own. */
  metadata?: Record<string, unknown> | null;
}

/**
 * One row of the Catalog table, exactly as `GET /admin/product-variants`
 * returns it: a variant, with its parent product embedded.
 *
 * `HttpTypes.AdminProductVariant` (queried with `product.*` in `fields`) is
 * structurally assignable to this.
 */
export interface CatalogVariantRow<TProduct extends CatalogProduct = CatalogProduct> {
  id: string;
  sku?: string | null;
  title?: string | null;
  thumbnail?: string | null;
  product?: TProduct | null;
  /** Custom data on the variant. The SRP is read from here. */
  metadata?: Record<string, unknown> | null;
  /**
   * The variant's price set, as `GET /admin/product-variants` returns it. A
   * variant that is not sold anywhere has none, which is a normal state, not a
   * missing field.
   */
  prices?: readonly CatalogPrice[] | null;
}

/**
 * The typed context handed to every column cell. Built once per row by
 * {@link buildVariantColumnContext}.
 *
 * ## One row is one variant
 *
 * The Catalog table lists **variants**, not products, so this context describes
 * exactly one variant. That is the whole point: a column that used to roll a
 * product's variants up into a coverage ratio ("12/13 costed", "3 offers / 1
 * conflict") now has a single variant to answer for, and can show the real
 * value instead of a summary of values.
 *
 * @typeParam TProduct - The parent product type. Defaults to the structural
 * {@link CatalogProduct}; pass `HttpTypes.AdminProduct` for the full type.
 */
export interface VariantColumnCellContext<TProduct extends CatalogProduct = CatalogProduct> {
  /** The row's variant, normalized to `{ id, sku, title, thumbnail }`. */
  variant: CatalogVariant;
  /** The variant's id. Shorthand for `ctx.variant.id`. */
  variantId: string;
  /** The variant's SKU, or `null` when it has none. */
  sku: string | null;
  /**
   * The parent product, or `null` when the row was fetched without it. Cells
   * that need product-level fields (title, status, handle) must handle `null`.
   */
  product: TProduct | null;
  /** The parent product's id, or `null`. */
  productId: string | null;

  /**
   * @deprecated The Catalog lists variants; a row has exactly one. This is
   * always `[ctx.variant]`, kept so a column written against the old
   * product-shaped context keeps compiling and now renders per variant. Read
   * {@link VariantColumnCellContext.variant} instead.
   */
  variants: CatalogVariant[];
  /**
   * @deprecated Always `[ctx.sku]`, or `[]` when the variant has no SKU. Kept
   * so an unmigrated `loadData` that queries by SKU list keeps working: it now
   * looks up exactly this row's SKU, which is the correct behaviour for a
   * variant row. Read {@link VariantColumnCellContext.sku} instead.
   */
  skus: string[];
  /**
   * @deprecated Always `ctx.sku`. Read {@link VariantColumnCellContext.sku}.
   */
  firstSku: string | null;
  /**
   * @deprecated Always `1`. A row is one variant, so any ratio built from this
   * is `n/1` and meaningless. Drop the aggregation instead.
   */
  variantCount: number;
}

/**
 * The state of a column's optional {@link VariantColumnDef.loadData} fetch for
 * one row, handed to `cell` as its second argument.
 *
 * A column with no `loadData` never receives this - `cell` is called with just
 * `ctx`. A column that declares `loadData` gets `cell` called again on every
 * state transition (`isLoading: true` first, then either `data` or `error` once
 * the fetch settles), so it can render a skeleton, then the real value or an
 * inline error - the base table never awaits the fetch.
 */
export interface VariantColumnAsyncState<TData = unknown> {
  /** The resolved value once `loadData` succeeds. `undefined` until then. */
  data: TData | undefined;
  /** Whether `loadData` is currently in flight for this row. */
  isLoading: boolean;
  /** The error `loadData` rejected with, if any. `null` while loading or on success. */
  error: unknown;
}

/**
 * A column contributed to the extensible Catalog table.
 *
 * Register one with {@link registerVariantColumn}. The kit's own base columns
 * (thumbnail, product, variant, SKU, status) always render first; registered
 * columns are appended after them, ordered by {@link priority}.
 *
 * @typeParam TProduct - The parent product type. See {@link VariantColumnCellContext}.
 * @typeParam TData - The value {@link loadData} resolves to, for a column that
 * needs a network round trip (e.g. an Allegro offer lookup, or a product-costs
 * cost lookup). Unused, and safely defaulted, by columns that derive everything
 * from `ctx` and never set `loadData`.
 */
export interface VariantColumnDef<
  TProduct extends CatalogProduct = CatalogProduct,
  TData = unknown,
> {
  /**
   * A stable, unique id. Namespace it to your plugin to avoid collisions with
   * other contributors, e.g. `"allegro.offer_status"` or `"product-costs.cost"`.
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
   * Renders the cell for a given variant row.
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
    ctx: VariantColumnCellContext<TProduct>,
    async?: VariantColumnAsyncState<TData>,
  ) => ReactNode;
  /**
   * Optional async loader for a cell backed by a network call. Runs once per
   * row, after the table has already rendered that row with `async.isLoading:
   * true` - it never blocks or delays the base table's own render or loading
   * state. Re-runs when the row's context identity changes (a new variant
   * object from a fresh page/search fetch).
   *
   * Resolve the value for **this one variant**. There is nothing to aggregate:
   * the row is a single variant, so a ratio or a roll-up here is a bug, not a
   * summary.
   */
  loadData?: (ctx: VariantColumnCellContext<TProduct>) => Promise<TData>;
}

/**
 * @deprecated Renamed to {@link CatalogVariant}.
 */
export type ProductColumnVariant = CatalogVariant;

/**
 * @deprecated Renamed to {@link CatalogProduct}. The `variants` array it used
 * to carry is gone: the Catalog fetches variants directly, so a row already is
 * a variant and never has to be expanded from a product.
 */
export type ProductColumnProduct = CatalogProduct;

/**
 * @deprecated Renamed to {@link VariantColumnCellContext}, and reshaped: the
 * Catalog now lists one variant per row, so `variants` / `skus` / `variantCount`
 * describe that single variant rather than the whole product, and `product` is
 * nullable. See the README's "Migrating from product rows".
 */
export type ProductColumnCellContext<TProduct extends CatalogProduct = CatalogProduct> =
  VariantColumnCellContext<TProduct>;

/**
 * @deprecated Renamed to {@link VariantColumnAsyncState}. Same shape.
 */
export type ProductColumnAsyncState<TData = unknown> = VariantColumnAsyncState<TData>;

/**
 * @deprecated Renamed to {@link VariantColumnDef}. Its `cell` and `loadData`
 * now receive a variant-shaped context; see {@link VariantColumnCellContext}.
 */
export type ProductColumnDef<
  TProduct extends CatalogProduct = CatalogProduct,
  TData = unknown,
> = VariantColumnDef<TProduct, TData>;
