import { beforeEach, describe, expect, it } from "vitest";
import { BASE_CATALOG_COLUMN_IDS, renderRegisteredCell, resolveCatalogColumns } from "../columns";
import type { CatalogVariantRow, VariantColumnDef } from "../types";
import {
  clearVariantColumns,
  getRegisteredVariantColumns,
  registerProductColumn,
  registerVariantColumn,
} from "../variant-columns";

/**
 * Exercises the full contributor pipeline the same way the admin runtime does:
 * register through the public API (as a contributor widget does at boot), pull
 * the ordered columns and merge them with the base ones (as the route does when
 * it renders), then run a cell against a built context (as the DataTable does
 * per row). This is the kit's integration surface without needing a live
 * dashboard.
 */
describe("registry integration (contributor pipeline)", () => {
  const row: CatalogVariantRow = {
    id: "variant_1",
    product: { id: "prod_1", status: "published", title: "Boots" },
    sku: "BOOT-40",
    title: "40",
  };

  beforeEach(() => {
    clearVariantColumns();
  });

  it("registers a variant column and renders its cell against a row", () => {
    registerVariantColumn({
      cell: (ctx) => `${ctx.product?.title} / ${ctx.variant.title} / ${ctx.sku}`,
      header: "Allegro",
      id: "allegro.offer_status",
      priority: 10,
    });

    const columns = getRegisteredVariantColumns();
    expect(columns.map((c) => c.id)).toEqual(["allegro.offer_status"]);
    expect(renderRegisteredCell(columns[0], row)).toBe("Boots / 40 / BOOT-40");
  });

  it("renders the whole table's column order: base columns, then contributors by priority", () => {
    registerVariantColumn({
      cell: (ctx) => ctx.sku ?? "-",
      header: "Allegro",
      id: "allegro.offer_status",
      priority: 10,
    });
    registerVariantColumn({
      cell: () => "12.50 PLN",
      header: "Cost",
      id: "product-costs.cost",
      priority: 20,
    });

    const resolved = resolveCatalogColumns(getRegisteredVariantColumns());
    expect(resolved.map((c) => c.id)).toEqual([
      ...BASE_CATALOG_COLUMN_IDS,
      "allegro.offer_status",
      "product-costs.cost",
    ]);
    // No two columns in the rendered table share an id, and none of the
    // contributed ones repeats a base column.
    expect(new Set(resolved.map((c) => c.id)).size).toBe(resolved.length);
  });

  it("still renders a column registered through the deprecated product-shaped API", () => {
    // The whole point of keeping the alias: a plugin nobody has migrated yet
    // keeps its column, and the old ctx fields resolve to this one variant.
    const legacy: VariantColumnDef = {
      cell: (ctx) => `${ctx.skus.length} sku, ${ctx.variantCount} variant`,
      header: "Legacy",
      id: "legacy.column",
    };
    registerProductColumn(legacy);

    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["legacy.column"]);
    expect(renderRegisteredCell(legacy, row)).toBe("1 sku, 1 variant");
  });

  it("isolates a throwing cell to that cell (the route catches it)", () => {
    // `renderRegisteredCell` is the raw call; the route wraps it in
    // `RegisteredVariantCell`, which is where the catch lives. Assert the raw
    // behaviour so the wrapper's job stays explicit.
    const boom: VariantColumnDef = {
      cell: () => {
        throw new Error("contributor bug");
      },
      header: "Boom",
      id: "boom",
    };
    expect(() => renderRegisteredCell(boom, row)).toThrow("contributor bug");
  });
});
