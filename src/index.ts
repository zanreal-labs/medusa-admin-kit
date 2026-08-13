/**
 * `@zanreal/medusa-admin-kit` public API.
 *
 * Contributor plugins import from here to add columns to the shared, extensible
 * products table:
 *
 * ```ts
 * import { registerProductColumn } from "@zanreal/medusa-admin-kit"
 *
 * registerProductColumn({
 *   id: "allegro.sync_status",
 *   header: "Allegro",
 *   priority: 10,
 *   cell: (ctx) => ctx.firstSku ?? "-",
 * })
 * ```
 *
 * See the README for the exact contributor contract (where to put that call so
 * it runs at admin boot).
 */

export {
  clearProductColumns,
  getProductColumn,
  getRegisteredProductColumns,
  hasProductColumn,
  registerProductColumn,
  unregisterProductColumn,
} from "./registry/product-columns";

export { buildProductColumnContext, extractSkus, normalizeVariant } from "./registry/context";

export {
  buildProductListQuery,
  DEFAULT_PAGE_SIZE,
  mapProductListResponse,
  PAGE_SIZE_OPTIONS,
  pageCount,
  PRODUCT_LIST_FIELDS,
} from "./registry/query";

export type {
  ProductListQuery,
  ProductListQueryInput,
  ProductListResponse,
} from "./registry/query";

export type {
  ProductColumnCellContext,
  ProductColumnDef,
  ProductColumnProduct,
  ProductColumnVariant,
} from "./registry/types";
