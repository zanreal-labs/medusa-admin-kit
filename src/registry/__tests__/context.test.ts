import { describe, expect, it } from "vitest";
import { buildProductColumnContext, extractSkus, normalizeVariant } from "../context";
import type { ProductColumnProduct } from "../types";

describe("normalizeVariant", () => {
  it("fills defaults for missing fields", () => {
    expect(normalizeVariant()).toEqual({
      id: "",
      sku: null,
      title: null,
    });
    expect(normalizeVariant({ id: "v1" })).toEqual({
      id: "v1",
      sku: null,
      title: null,
    });
    expect(normalizeVariant({ id: "v1", sku: "S", title: "T" })).toEqual({
      id: "v1",
      sku: "S",
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

describe("buildProductColumnContext", () => {
  const product: ProductColumnProduct = {
    handle: "widget",
    id: "prod_1",
    status: "published",
    thumbnail: "https://example.test/w.png",
    title: "Widget",
    variants: [
      { id: "v1", sku: "W-1", title: "Small" },
      { id: "v2", sku: "W-2", title: "Large" },
      { id: "v3", sku: null, title: "No SKU" },
    ],
  };

  it("shapes the full context", () => {
    const ctx = buildProductColumnContext(product);
    expect(ctx.product).toBe(product);
    expect(ctx.variantCount).toBe(3);
    expect(ctx.skus).toEqual(["W-1", "W-2"]);
    expect(ctx.firstSku).toBe("W-1");
    expect(ctx.variants).toEqual([
      { id: "v1", sku: "W-1", title: "Small" },
      { id: "v2", sku: "W-2", title: "Large" },
      { id: "v3", sku: null, title: "No SKU" },
    ]);
  });

  it("handles a product with no variants", () => {
    const ctx = buildProductColumnContext({ id: "prod_2" });
    expect(ctx.variantCount).toBe(0);
    expect(ctx.skus).toEqual([]);
    expect(ctx.firstSku).toBeNull();
    expect(ctx.variants).toEqual([]);
  });

  it("handles null variants", () => {
    const ctx = buildProductColumnContext({ id: "prod_3", variants: null });
    expect(ctx.variantCount).toBe(0);
    expect(ctx.firstSku).toBeNull();
  });

  it("preserves the product's static type through the generic", () => {
    interface RichProduct extends ProductColumnProduct {
      metadata: { warehouse: string };
    }
    const rich: RichProduct = {
      id: "prod_4",
      metadata: { warehouse: "PL-1" },
    };
    const ctx = buildProductColumnContext(rich);
    // `ctx.product` is typed as RichProduct, so this reads without a cast.
    expect(ctx.product.metadata.warehouse).toBe("PL-1");
  });
});
