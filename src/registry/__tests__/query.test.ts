import { describe, expect, it } from "vitest";
import {
  buildProductListQuery,
  mapProductListResponse,
  pageCount,
  PRODUCT_LIST_FIELDS,
} from "../query";

describe("buildProductListQuery", () => {
  it("computes limit and offset from page state", () => {
    expect(buildProductListQuery({ pageIndex: 0, pageSize: 20 })).toEqual({
      fields: PRODUCT_LIST_FIELDS,
      limit: 20,
      offset: 0,
    });
    expect(buildProductListQuery({ pageIndex: 2, pageSize: 20 })).toEqual({
      fields: PRODUCT_LIST_FIELDS,
      limit: 20,
      offset: 40,
    });
    expect(buildProductListQuery({ pageIndex: 3, pageSize: 50 })).toMatchObject({
      limit: 50,
      offset: 150,
    });
  });

  it("requests variant sku fields so columns can key on SKU", () => {
    expect(PRODUCT_LIST_FIELDS).toContain("variants.sku");
  });

  it("includes a trimmed search as q, and omits blank searches", () => {
    expect(buildProductListQuery({ pageIndex: 0, pageSize: 20, search: "  boot  " }).q).toBe(
      "boot",
    );
    expect(buildProductListQuery({ pageIndex: 0, pageSize: 20, search: "" }).q).toBeUndefined();
    expect(buildProductListQuery({ pageIndex: 0, pageSize: 20, search: "   " }).q).toBeUndefined();
    expect(buildProductListQuery({ pageIndex: 0, pageSize: 20 }).q).toBeUndefined();
  });

  it("guards against negative or fractional page state", () => {
    expect(buildProductListQuery({ pageIndex: -3, pageSize: 20 }).offset).toBe(0);
    expect(buildProductListQuery({ pageIndex: 1.9, pageSize: 20.5 })).toMatchObject({
      limit: 20,
      offset: 20,
    });
  });
});

describe("mapProductListResponse", () => {
  it("returns products and count", () => {
    expect(mapProductListResponse({ count: 42, products: [{ id: "a" }, { id: "b" }] })).toEqual({
      count: 42,
      products: [{ id: "a" }, { id: "b" }],
    });
  });

  it("tolerates a missing list or count", () => {
    expect(mapProductListResponse(null)).toEqual({ count: 0, products: [] });
    expect(mapProductListResponse({})).toEqual({ count: 0, products: [] });
    expect(mapProductListResponse({ products: [{ id: "a" }] })).toEqual({
      count: 1,
      products: [{ id: "a" }],
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
