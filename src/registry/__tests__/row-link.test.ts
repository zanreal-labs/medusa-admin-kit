import { describe, expect, it } from "vitest";
import { unwrapClickedRow, variantDetailHref } from "../row-link";
import type { CatalogVariantRow } from "../types";

describe("variantDetailHref", () => {
  it("links a row to that variant's detail page under its product", () => {
    // The same path the stock dashboard's own variant table links to, so the
    // Catalog lands on the screen the rest of the admin would.
    expect(
      variantDetailHref({ id: "variant_1", product: { id: "prod_1" }, sku: "A" }),
    ).toBe("/products/prod_1/variants/variant_1");
  });

  it("is router-relative, with no dashboard base path baked in", () => {
    const href = variantDetailHref({ id: "v", product: { id: "p" } });
    expect(href?.startsWith("/products/")).toBe(true);
    expect(href).not.toContain("/app/");
  });

  it("returns null when the row cannot address a variant page", () => {
    expect(variantDetailHref({ id: "variant_1" })).toBeNull();
    expect(variantDetailHref({ id: "variant_1", product: null })).toBeNull();
    expect(variantDetailHref({ id: "", product: { id: "prod_1" } })).toBeNull();
  });
});

describe("unwrapClickedRow", () => {
  const row: CatalogVariantRow = { id: "variant_1", product: { id: "prod_1" } };

  it("unwraps the TanStack row wrapper the DataTable actually passes", () => {
    expect(unwrapClickedRow({ original: row })).toBe(row);
  });

  it("passes a bare row through, which is what the types promise", () => {
    expect(unwrapClickedRow(row)).toBe(row);
  });
});
