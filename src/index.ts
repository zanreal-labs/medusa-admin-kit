/**
 * `@zanreal/medusa-admin-kit` public API.
 *
 * Contributor plugins import from here to add columns to the shared, extensible
 * Catalog table. The table lists one **variant** per row, so a column answers
 * for a single variant:
 *
 * ```ts
 * import { registerVariantColumn } from "@zanreal/medusa-admin-kit"
 *
 * registerVariantColumn({
 *   id: "allegro.offer_status",
 *   header: "Allegro",
 *   priority: 10,
 *   cell: (ctx) => ctx.sku ?? "-",
 * })
 * ```
 *
 * See the README for the exact contributor contract (where to put that call so
 * it runs at admin boot) and for migrating a column written against the older
 * product-row API.
 */

export {
  clearProductColumns,
  clearVariantColumns,
  getProductColumn,
  getRegisteredProductColumns,
  getRegisteredVariantColumns,
  getVariantColumn,
  hasProductColumn,
  hasVariantColumn,
  registerProductColumn,
  registerVariantColumn,
  unregisterProductColumn,
  unregisterVariantColumn,
} from "./registry/variant-columns";

export { buildVariantColumnContext, extractSkus, normalizeVariant } from "./registry/context";

export {
  BASE_CATALOG_COLUMN_IDS,
  renderRegisteredCell,
  resolveCatalogColumns,
} from "./registry/columns";

export type { BaseCatalogColumnId, ResolvedCatalogColumn } from "./registry/columns";

export { unwrapClickedRow, variantDetailHref } from "./registry/row-link";

export {
  buildVariantListQuery,
  DEFAULT_PAGE_SIZE,
  mapVariantListResponse,
  PAGE_SIZE_OPTIONS,
  pageCount,
  VARIANT_LIST_FIELDS,
} from "./registry/query";

export type {
  VariantListQuery,
  VariantListQueryInput,
  VariantListResponse,
} from "./registry/query";

export type {
  CatalogProduct,
  CatalogVariant,
  CatalogVariantRow,
  ProductColumnAsyncState,
  ProductColumnCellContext,
  ProductColumnDef,
  ProductColumnProduct,
  ProductColumnVariant,
  VariantColumnAsyncState,
  VariantColumnCellContext,
  VariantColumnDef,
} from "./registry/types";
