/**
 * Pure helpers that translate the Catalog table's UI state (page, page size,
 * search) into admin product-variants API query params, and its response back
 * into the `{ variants, count }` the table renders. Kept free of the admin
 * runtime so the mapping can be unit-tested on its own.
 */

/** Default rows per page. */
export const DEFAULT_PAGE_SIZE = 20;

/** Page-size options offered in the toolbar. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Fields requested from `GET /admin/product-variants`.
 *
 * The table lists variants, so it queries variants: one API row is one table
 * row, `count` is a variant count, and pagination is exact. Flattening a page
 * of products client-side would give neither. The parent product is pulled in
 * on the same request (`product.*`) so the product cell, the status cell and
 * the row link never need a second round trip.
 */
export const VARIANT_LIST_FIELDS =
  "id,title,sku,thumbnail,product.id,product.title,product.handle,product.status,product.thumbnail";

/** UI state the table holds. */
export interface VariantListQueryInput {
  pageIndex: number;
  pageSize: number;
  search?: string;
}

/** Query params passed to the admin product-variants API. */
export interface VariantListQuery {
  limit: number;
  offset: number;
  fields: string;
  q?: string;
}

/**
 * Build the admin product-variants API query for a given page of the table.
 * `offset` is derived from `pageIndex * pageSize`; a blank or whitespace-only
 * search is omitted rather than sent as an empty `q`.
 */
export function buildVariantListQuery(input: VariantListQueryInput): VariantListQuery {
  const pageIndex = Math.max(0, Math.floor(input.pageIndex));
  const pageSize = Math.max(1, Math.floor(input.pageSize));
  const trimmed = input.search?.trim();

  const query: VariantListQuery = {
    fields: VARIANT_LIST_FIELDS,
    limit: pageSize,
    offset: pageIndex * pageSize,
  };
  if (trimmed) {
    query.q = trimmed;
  }
  return query;
}

/** The relevant slice of a `GET /admin/product-variants` response. */
export interface VariantListResponse<TVariant> {
  variants?: TVariant[] | null;
  count?: number | null;
}

/**
 * Normalize a product-variants API response into `{ variants, count }`,
 * tolerating a missing list or count.
 */
export function mapVariantListResponse<TVariant>(
  response: VariantListResponse<TVariant> | null | undefined,
): { variants: TVariant[]; count: number } {
  const variants = response?.variants ?? [];
  return {
    count: response?.count ?? variants.length,
    variants,
  };
}

/** Total page count for a given row count and page size (at least 1). */
export function pageCount(count: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(Math.max(0, count) / pageSize));
}
