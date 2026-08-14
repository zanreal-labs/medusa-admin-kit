import { describe, expect, it } from "vitest";
import { BASE_CATALOG_COLUMN_IDS, renderRegisteredCell, resolveCatalogColumns } from "../columns";
import type { CatalogProduct, CatalogVariantRow, VariantColumnDef } from "../types";

const column = (id: string, priority?: number): VariantColumnDef => ({
  cell: () => id,
  header: id,
  id,
  priority,
});

describe("resolveCatalogColumns", () => {
  it("puts the base columns first, in their canonical order", () => {
    const resolved = resolveCatalogColumns([]);
    expect(resolved.map((c) => c.id)).toEqual([...BASE_CATALOG_COLUMN_IDS]);
    expect(resolved.every((c) => c.source === "base")).toBe(true);
  });

  it("has no handle column and no aggregate SKU-summary column", () => {
    // `handle` was pure width on a variant row, and a "2 variants - SKU-1"
    // summary has nothing left to summarize once a row IS one variant. The
    // kit also ships no demo column of its own any more: that column rendered
    // the same string as the base SKU summary, which is what read as a
    // duplicated column in the table.
    const ids: readonly string[] = BASE_CATALOG_COLUMN_IDS;
    expect(ids).not.toContain("handle");
    expect(ids).not.toContain("sku_summary");
    expect(ids).toContain("sku");
  });

  it("gives every base column a distinct id, so no base column can render twice", () => {
    const ids: readonly string[] = BASE_CATALOG_COLUMN_IDS;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("appends registered columns after the base ones, preserving input order", () => {
    // `resolveCatalogColumns` trusts the caller's order (the registry already
    // sorts by priority), so pass them pre-sorted.
    const resolved = resolveCatalogColumns([
      column("allegro.offer_status", 10),
      column("product-costs.cost", 20),
    ]);
    expect(resolved.map((c) => c.id)).toEqual([
      ...BASE_CATALOG_COLUMN_IDS,
      "allegro.offer_status",
      "product-costs.cost",
    ]);
  });

  it("keeps the def on registered entries and marks their source", () => {
    const def = column("allegro.offer_status", 10);
    const resolved = resolveCatalogColumns([def]);
    const contributed = resolved.at(-1);
    expect(contributed).toEqual({ def, id: "allegro.offer_status", source: "registered" });
  });

  it("produces a unique id per column", () => {
    const resolved = resolveCatalogColumns([column("a"), column("b")]);
    const ids = resolved.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renderRegisteredCell", () => {
  const product: CatalogProduct = { id: "prod_1", title: "Boots" };
  const row: CatalogVariantRow = { id: "v1", product, sku: "BOOT-1", title: "40" };

  it("builds the context and calls the column's cell (what the route does per row)", () => {
    const def: VariantColumnDef = {
      cell: (ctx) => `${ctx.variant.title}:${ctx.sku}`,
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(def, row)).toBe("40:BOOT-1");
  });

  it("passes the exact parent product through as ctx.product", () => {
    const def: VariantColumnDef = {
      cell: (ctx) => (ctx.product === product ? "same-ref" : "copy"),
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(def, row)).toBe("same-ref");
  });

  it("keeps an unmigrated product-shaped cell rendering, scoped to the row", () => {
    const legacy: VariantColumnDef = {
      cell: (ctx) => `${ctx.variantCount}:${ctx.firstSku}`,
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(legacy, row)).toBe("1:BOOT-1");
  });

  it("calls a sync column's cell with `async` undefined", () => {
    const def: VariantColumnDef = {
      cell: (_ctx, async) => (async === undefined ? "sync" : "async"),
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(def, row)).toBe("sync");
  });

  it("threads an explicit async state through to an async-aware column's cell", () => {
    const def: VariantColumnDef<CatalogProduct, string> = {
      cell: (_ctx, async) => {
        if (!async) {
          return "no-state";
        }
        if (async.isLoading) {
          return "loading";
        }
        if (async.error) {
          return "error";
        }
        return `data:${async.data}`;
      },
      header: "Allegro",
      id: "allegro.offer_status",
      loadData: async () => "listed",
    };

    expect(renderRegisteredCell(def, row, { data: undefined, error: null, isLoading: true })).toBe(
      "loading",
    );
    expect(renderRegisteredCell(def, row, { data: "listed", error: null, isLoading: false })).toBe(
      "data:listed",
    );
    expect(
      renderRegisteredCell(def, row, {
        data: undefined,
        error: new Error("boom"),
        isLoading: false,
      }),
    ).toBe("error");
  });
});
