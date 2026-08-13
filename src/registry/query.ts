/**
 * Pure helpers that translate the products table's UI state (page, page size,
 * search) into admin products API query params, and its response back into the
 * `{ products, count }` the table renders. Kept free of the admin runtime so the
 * mapping can be unit-tested on its own.
 */

/** Default rows per page. */
export const DEFAULT_PAGE_SIZE = 20;

/** Page-size options offered in the toolbar. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Fields requested from `GET /admin/products`. Includes each variant's id,
 * title and SKU so columns can key on SKU without a second round-trip.
 */
export const PRODUCT_LIST_FIELDS =
  "id,title,handle,status,thumbnail,variants.id,variants.title,variants.sku";

/** UI state the table holds. */
export interface ProductListQueryInput {
  pageIndex: number;
  pageSize: number;
  search?: string;
}

/** Query params passed to the admin products API. */
export interface ProductListQuery {
  limit: number;
  offset: number;
  fields: string;
  q?: string;
}

/**
 * Build the admin products API query for a given page of the table. `offset` is
 * derived from `pageIndex * pageSize`; a blank or whitespace-only search is
 * omitted rather than sent as an empty `q`.
 */
export function buildProductListQuery(input: ProductListQueryInput): ProductListQuery {
  const pageIndex = Math.max(0, Math.floor(input.pageIndex));
  const pageSize = Math.max(1, Math.floor(input.pageSize));
  const trimmed = input.search?.trim();

  const query: ProductListQuery = {
    fields: PRODUCT_LIST_FIELDS,
    limit: pageSize,
    offset: pageIndex * pageSize,
  };
  if (trimmed) {
    query.q = trimmed;
  }
  return query;
}

/** The relevant slice of a `GET /admin/products` response. */
export interface ProductListResponse<TProduct> {
  products?: TProduct[] | null;
  count?: number | null;
}

/**
 * Normalize a products API response into `{ products, count }`, tolerating a
 * missing list or count.
 */
export function mapProductListResponse<TProduct>(
  response: ProductListResponse<TProduct> | null | undefined,
): { products: TProduct[]; count: number } {
  const products = response?.products ?? [];
  return {
    count: response?.count ?? products.length,
    products,
  };
}

/** Total page count for a given row count and page size (at least 1). */
export function pageCount(count: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(Math.max(0, count) / pageSize));
}
