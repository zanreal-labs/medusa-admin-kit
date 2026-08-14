import { describe, expect, it } from "vitest";
import { buildVariantColumnContext, extractSkus, normalizeVariant } from "../context";
import type { CatalogProduct, CatalogVariantRow } from "../types";

describe("normalizeVariant", () => {
  it("fills defaults for missing fields", () => {
    expect(normalizeVariant()).toEqual({
      id: "",
      sku: null,
      thumbnail: null,
      title: null,
    });
    expect(normalizeVariant({ id: "v1" })).toEqual({
      id: "v1",
      sku: null,
      thumbnail: null,
      title: null,
    });
    expect(normalizeVariant({ id: "v1", sku: "S", thumbnail: "T.png", title: "T" })).toEqual({
      id: "v1",
      sku: "S",
      thumbnail: "T.png",
      title: "T",
    });
  });
});

describe("extractSkus", () => {
  it("returns [] for missing variants", () => {
    expect(extractSkus(null)).toEqual([]);
    expect(extractSkus()).toEqual([]);
    expect(extractSkus([])).toEqual([]);
  });

  it("collects non-empty skus in order", () => {
    expect(extractSkus([{ sku: "A" }, { sku: "B" }, { sku: "C" }])).toEqual(["A", "B", "C"]);
  });

  it("skips empty and nullish skus", () => {
    expect(extractSkus([{ sku: "" }, { sku: null }, { sku: undefined }, { sku: "A" }])).toEqual([
      "A",
    ]);
  });

  it("de-duplicates while preserving first-seen order", () => {
    expect(extractSkus([{ sku: "A" }, { sku: "B" }, { sku: "A" }])).toEqual(["A", "B"]);
  });
});

describe("buildVariantColumnContext", () => {
  const product: CatalogProduct = {
    handle: "widget",
    id: "prod_1",
    status: "published",
    thumbnail: "https://example.test/w.png",
    title: "Widget",
  };
  const row: CatalogVariantRow = {
    id: "v1",
    product,
    sku: "W-1",
    thumbnail: null,
    title: "Small",
  };

  it("shapes the full context from one variant row", () => {
    const ctx = buildVariantColumnContext(row);
    expect(ctx.variant).toEqual({ id: "v1", sku: "W-1", thumbnail: null, title: "Small" });
    expect(ctx.variantId).toBe("v1");
    expect(ctx.sku).toBe("W-1");
    expect(ctx.product).toBe(product);
    expect(ctx.productId).toBe("prod_1");
  });

  it("scopes the deprecated product-shaped fields to this one variant", () => {
    // This is the soft landing for a column written before the table listed
    // variants: its SKU lookup now hits exactly this row's SKU, and any ratio
    // it builds is n/1 rather than a product-wide coverage figure.
    const ctx = buildVariantColumnContext(row);
    expect(ctx.variants).toEqual([ctx.variant]);
    expect(ctx.skus).toEqual(["W-1"]);
    expect(ctx.firstSku).toBe("W-1");
    expect(ctx.variantCount).toBe(1);
  });

  it("handles a variant with no SKU", () => {
    const ctx = buildVariantColumnContext({ id: "v2", product, sku: null });
    expect(ctx.sku).toBeNull();
    expect(ctx.firstSku).toBeNull();
    expect(ctx.skus).toEqual([]);
    expect(ctx.variantCount).toBe(1);
  });

  it("handles a row fetched without its parent product", () => {
    const ctx = buildVariantColumnContext({ id: "v3", sku: "W-3" });
    expect(ctx.product).toBeNull();
    expect(ctx.productId).toBeNull();
  });

  it("preserves the product's static type through the generic", () => {
    interface RichProduct extends CatalogProduct {
      metadata: { warehouse: string };
    }
    const rich: RichProduct = {
      id: "prod_4",
      metadata: { warehouse: "PL-1" },
    };
    const ctx = buildVariantColumnContext<RichProduct>({ id: "v4", product: rich });
    // `ctx.product` is typed as RichProduct | null, so this reads without a cast.
    expect(ctx.product?.metadata.warehouse).toBe("PL-1");
  });
});
