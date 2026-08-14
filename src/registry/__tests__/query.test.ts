import { describe, expect, it } from "vitest";
import {
  buildVariantListQuery,
  mapVariantListResponse,
  pageCount,
  VARIANT_LIST_FIELDS,
} from "../query";

describe("buildVariantListQuery", () => {
  it("computes limit and offset from page state", () => {
    expect(buildVariantListQuery({ pageIndex: 0, pageSize: 20 })).toEqual({
      fields: VARIANT_LIST_FIELDS,
      limit: 20,
      offset: 0,
    });
    expect(buildVariantListQuery({ pageIndex: 2, pageSize: 20 })).toEqual({
      fields: VARIANT_LIST_FIELDS,
      limit: 20,
      offset: 40,
    });
    expect(buildVariantListQuery({ pageIndex: 3, pageSize: 50 })).toMatchObject({
      limit: 50,
      offset: 150,
    });
  });

  it("requests the variant's own fields plus its parent product", () => {
    // The row is a variant, so `sku` is the row's SKU, and the parent product
    // comes along on the same request: the product cell, the status cell and
    // the row link all read it without a second round trip.
    expect(VARIANT_LIST_FIELDS).toContain("sku");
    expect(VARIANT_LIST_FIELDS).toContain("product.id");
    expect(VARIANT_LIST_FIELDS).toContain("product.title");
    expect(VARIANT_LIST_FIELDS).toContain("product.status");
    expect(VARIANT_LIST_FIELDS).not.toContain("variants.");
  });

  it("pulls both money sources onto the same request as the row", () => {
    // This is what makes the shop-price and SRP columns cost zero extra
    // requests: a page of 100 variants arrives with its prices and metadata
    // already attached, so neither column ever fetches per row.
    expect(VARIANT_LIST_FIELDS).toContain("*prices");
    expect(VARIANT_LIST_FIELDS).toContain("metadata");
    // The SRP falls back to the product's metadata, so that has to come too.
    expect(VARIANT_LIST_FIELDS).toContain("product.metadata");
  });

  it("includes a trimmed search as q, and omits blank searches", () => {
    expect(buildVariantListQuery({ pageIndex: 0, pageSize: 20, search: "  boot  " }).q).toBe(
      "boot",
    );
    expect(buildVariantListQuery({ pageIndex: 0, pageSize: 20, search: "" }).q).toBeUndefined();
    expect(buildVariantListQuery({ pageIndex: 0, pageSize: 20, search: "   " }).q).toBeUndefined();
    expect(buildVariantListQuery({ pageIndex: 0, pageSize: 20 }).q).toBeUndefined();
  });

  it("guards against negative or fractional page state", () => {
    expect(buildVariantListQuery({ pageIndex: -3, pageSize: 20 }).offset).toBe(0);
    expect(buildVariantListQuery({ pageIndex: 1.9, pageSize: 20.5 })).toMatchObject({
      limit: 20,
      offset: 20,
    });
  });
});

describe("mapVariantListResponse", () => {
  it("returns variants and count", () => {
    expect(mapVariantListResponse({ count: 42, variants: [{ id: "a" }, { id: "b" }] })).toEqual({
      count: 42,
      variants: [{ id: "a" }, { id: "b" }],
    });
  });

  it("tolerates a missing list or count", () => {
    expect(mapVariantListResponse(null)).toEqual({ count: 0, variants: [] });
    expect(mapVariantListResponse({})).toEqual({ count: 0, variants: [] });
    expect(mapVariantListResponse({ variants: [{ id: "a" }] })).toEqual({
      count: 1,
      variants: [{ id: "a" }],
    });
  });
});

describe("pageCount", () => {
  it("computes the number of pages", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
    expect(pageCount(41, 20)).toBe(3);
  });

  it("never returns less than 1 and guards bad input", () => {
    expect(pageCount(-5, 20)).toBe(1);
    expect(pageCount(10, 0)).toBe(1);
  });
});
