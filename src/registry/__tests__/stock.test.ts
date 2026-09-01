import { describe, expect, it } from "vitest";
import { isVariantOutOfStock, readVariantStock } from "../stock";

describe("readVariantStock", () => {
  it("reports a managed variant's quantity", () => {
    expect(readVariantStock({ inventory_quantity: 7, manage_inventory: true })).toEqual({
      quantity: 7,
      state: "tracked",
    });
  });

  it("reports a sold-out managed variant as tracked zero, not as missing", () => {
    // The one value the column exists to surface. It has to stay a number all
    // the way to the cell so it can be coloured; collapsing it into the
    // "nothing to show" branch would hide exactly what an operator scans for.
    expect(readVariantStock({ inventory_quantity: 0, manage_inventory: true })).toEqual({
      quantity: 0,
      state: "tracked",
    });
  });

  it("distinguishes a variant that does not manage inventory from one with none left", () => {
    // `wrapVariantsWithTotalInventoryQuantity` skips unmanaged variants
    // entirely, so this row arrives with no quantity at all. Reading that as 0
    // would paint every made-to-order variant as sold out.
    expect(readVariantStock({ manage_inventory: false })).toEqual({ state: "untracked" });
    expect(readVariantStock({ inventory_quantity: 0, manage_inventory: false })).toEqual({
      state: "untracked",
    });
  });

  it("treats an unrequested field as unknown rather than as untracked", () => {
    // `undefined` means nobody asked for the field; `false` means the store
    // switched counting off. Only the second is a fact about the variant.
    expect(readVariantStock({})).toEqual({ state: "unknown" });
    expect(readVariantStock({ manage_inventory: true })).toEqual({ state: "unknown" });
    expect(readVariantStock(null)).toEqual({ state: "unknown" });
    expect(readVariantStock(undefined)).toEqual({ state: "unknown" });
  });

  it("never coerces an unreadable quantity into a number", () => {
    expect(readVariantStock({ inventory_quantity: Number.NaN, manage_inventory: true })).toEqual({
      state: "unknown",
    });
    expect(
      readVariantStock({ inventory_quantity: null, manage_inventory: true }),
    ).toEqual({ state: "unknown" });
  });

  it("carries a negative quantity through rather than clamping it", () => {
    // An oversold variant is a real state and the operator has to see it.
    expect(readVariantStock({ inventory_quantity: -3, manage_inventory: true })).toEqual({
      quantity: -3,
      state: "tracked",
    });
  });
});

describe("isVariantOutOfStock", () => {
  it("flags only a tracked, non-positive quantity", () => {
    expect(isVariantOutOfStock({ quantity: 0, state: "tracked" })).toBe(true);
    expect(isVariantOutOfStock({ quantity: -1, state: "tracked" })).toBe(true);
    expect(isVariantOutOfStock({ quantity: 1, state: "tracked" })).toBe(false);
  });

  it("does not flag a row the store is not counting", () => {
    expect(isVariantOutOfStock({ state: "untracked" })).toBe(false);
    expect(isVariantOutOfStock({ state: "unknown" })).toBe(false);
  });
});
