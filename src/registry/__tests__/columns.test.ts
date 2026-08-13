import { describe, expect, it } from "vitest";
import { BASE_PRODUCT_COLUMN_IDS, renderRegisteredCell, resolveProductColumns } from "../columns";
import type { ProductColumnDef, ProductColumnProduct } from "../types";

const column = (id: string, priority?: number): ProductColumnDef => ({
  cell: () => id,
  header: id,
  id,
  priority,
});

describe("resolveProductColumns", () => {
  it("puts the base columns first, in their canonical order", () => {
    const resolved = resolveProductColumns([]);
    expect(resolved.map((c) => c.id)).toEqual([...BASE_PRODUCT_COLUMN_IDS]);
    expect(resolved.every((c) => c.source === "base")).toBe(true);
  });

  it("appends registered columns after the base ones, preserving input order", () => {
    // `resolveProductColumns` trusts the caller's order (the registry already
    // sorts by priority), so pass them pre-sorted.
    const resolved = resolveProductColumns([
      column("allegro.sync", 10),
      column("costs.margin", 20),
    ]);
    expect(resolved.map((c) => c.id)).toEqual([
      ...BASE_PRODUCT_COLUMN_IDS,
      "allegro.sync",
      "costs.margin",
    ]);
  });

  it("keeps the def on registered entries and marks their source", () => {
    const def = column("allegro.sync", 10);
    const resolved = resolveProductColumns([def]);
    const contributed = resolved.at(-1);
    expect(contributed).toEqual({ def, id: "allegro.sync", source: "registered" });
  });

  it("produces a unique id per column", () => {
    const resolved = resolveProductColumns([column("a"), column("b")]);
    const ids = resolved.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renderRegisteredCell", () => {
  const product: ProductColumnProduct = {
    id: "prod_1",
    title: "Boots",
    variants: [
      { id: "v1", sku: "BOOT-1", title: "40" },
      { id: "v2", sku: "BOOT-2", title: "41" },
    ],
  };

  it("builds the context and calls the column's cell (what the route does per row)", () => {
    const def: ProductColumnDef = {
      cell: (ctx) => `${ctx.variantCount}:${ctx.firstSku}`,
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(def, product)).toBe("2:BOOT-1");
  });

  it("passes the exact product row through as ctx.product", () => {
    const def: ProductColumnDef = {
      cell: (ctx) => (ctx.product === product ? "same-ref" : "copy"),
      header: "x",
      id: "x",
    };
    expect(renderRegisteredCell(def, product)).toBe("same-ref");
  });
});
