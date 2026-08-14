import { describe, expect, it } from "vitest";
import {
  formatAmount,
  readAmount,
  readVariantSrp,
  readVariantSrpMoney,
  selectVariantPrice,
  SRP_METADATA_KEY,
  srpCurrencyKey,
} from "../money";

/**
 * A stand-in for a live Medusa `BigNumber`: the readable surface lives on the
 * prototype (`numeric`, `raw`, `valueOf`) while the instance's own enumerable
 * keys are the trailing-underscore privates. Built as a class so the test is
 * exercising the same access pattern the real one imposes, without importing
 * the framework into a pure unit test.
 */
class FakeBigNumber {
  private readonly numeric_: number;
  private readonly raw_: { value: string; precision: number };

  constructor(value: string) {
    this.numeric_ = Number(value);
    this.raw_ = { precision: 20, value };
  }

  get numeric(): number {
    return this.numeric_;
  }

  get raw(): { value: string; precision: number } {
    return this.raw_;
  }

  valueOf(): number {
    return this.numeric_;
  }

  toJSON(): number {
    return this.numeric_;
  }
}

describe("readAmount", () => {
  it("reads a plain number, which is what a price is over HTTP", () => {
    expect(readAmount(365.31)).toBe(365.31);
    expect(readAmount(0)).toBe(0);
  });

  it("reads a string amount, which is what metadata and Allegro store", () => {
    expect(readAmount("365.31")).toBe(365.31);
    expect(readAmount(" 42 ")).toBe(42);
  });

  it("reads a live BigNumber through its public coercion", () => {
    expect(readAmount(new FakeBigNumber("1299.99"))).toBe(1299.99);
  });

  it("reads a bare raw value and a BigNumber that lost its prototype", () => {
    expect(readAmount({ precision: 20, value: "12.34" })).toBe(12.34);
    // A spread / structured clone keeps only the privates.
    expect(readAmount({ numeric_: 9.5, raw_: { precision: 20, value: "9.50" } })).toBe(9.5);
  });

  it("returns null, never 0, for anything it cannot read", () => {
    // This is the whole point: 0 is a legitimate price, so an unreadable value
    // must not become one. A previous defect in this project shipped exactly
    // that way.
    for (const value of [null, undefined, "", "   ", "abc", {}, [], Number.NaN, true]) {
      expect(readAmount(value)).toBeNull();
    }
  });

  it("does not truncate a malformed amount into a plausible one", () => {
    // `Number.parseFloat("365 PLN")` is 365. Reading it that way would turn a
    // broken field into a number an operator would trust.
    expect(readAmount("365 PLN")).toBeNull();
    expect(readAmount("12abc")).toBeNull();
  });
});

describe("selectVariantPrice", () => {
  it("returns null when the variant has no prices at all", () => {
    expect(selectVariantPrice(null)).toBeNull();
    expect(selectVariantPrice([])).toBeNull();
    // 16 of this store's 77 variants are in exactly this state and it is
    // correct: they are not offered for sale.
    expect(selectVariantPrice(undefined)).toBeNull();
  });

  it("returns the amount with its currency, uppercased", () => {
    expect(selectVariantPrice([{ amount: 365.31, currency_code: "pln" }])).toEqual({
      otherCount: 0,
      price: { amount: 365.31, currency: "PLN" },
    });
  });

  it("prefers the plain per-unit price over scoped and tiered ones", () => {
    const selection = selectVariantPrice([
      { amount: 300, currency_code: "pln", min_quantity: 10, max_quantity: null },
      { amount: 320, currency_code: "pln", rules: { region_id: "reg_1" } },
      { amount: 365.31, currency_code: "pln", max_quantity: null, min_quantity: null },
    ]);
    expect(selection?.price).toEqual({ amount: 365.31, currency: "PLN" });
    expect(selection?.otherCount).toBe(2);
  });

  it("still shows a price when the variant only has scoped or tiered ones", () => {
    const selection = selectVariantPrice([
      { amount: 300, currency_code: "pln", min_quantity: 10 },
    ]);
    expect(selection?.price).toEqual({ amount: 300, currency: "PLN" });
  });

  it("picks the same currency every time when there is more than one", () => {
    const prices = [
      { amount: 90, currency_code: "usd", max_quantity: null, min_quantity: null },
      { amount: 365.31, currency_code: "pln", max_quantity: null, min_quantity: null },
      { amount: 80, currency_code: "eur", max_quantity: null, min_quantity: null },
    ];
    expect(selectVariantPrice(prices)?.price.currency).toBe("EUR");
    expect(selectVariantPrice([...prices].reverse())?.price.currency).toBe("EUR");
    expect(selectVariantPrice(prices)?.otherCount).toBe(2);
  });

  it("skips prices whose amount is unreadable rather than counting them as 0", () => {
    const selection = selectVariantPrice([
      { amount: null, currency_code: "eur" },
      { amount: 365.31, currency_code: "pln" },
    ]);
    expect(selection).toEqual({ otherCount: 0, price: { amount: 365.31, currency: "PLN" } });
  });

  it("reads a BigNumber-shaped amount", () => {
    const selection = selectVariantPrice([
      { amount: new FakeBigNumber("1299.99"), currency_code: "pln" },
    ]);
    expect(selection?.price.amount).toBe(1299.99);
  });
});

describe("readVariantSrp", () => {
  it("reads the string amount out of the variant's metadata", () => {
    expect(readVariantSrp({ metadata: { srp: "399.00" } })).toBe(399);
  });

  it("falls back to the product's metadata", () => {
    // The Allegro price sync resolves the ceiling with the same precedence, so
    // a column that skipped the fallback would show a dash for an SRP that is
    // very much in use.
    expect(readVariantSrp({ metadata: {}, product: { metadata: { srp: "399.00" } } })).toBe(399);
    expect(
      readVariantSrp({ metadata: { srp: "350" }, product: { metadata: { srp: "399" } } }),
    ).toBe(350);
  });

  it("returns null when neither carries one, and for a blank value", () => {
    expect(readVariantSrp({})).toBeNull();
    expect(readVariantSrp({ metadata: null, product: null })).toBeNull();
    expect(readVariantSrp({ metadata: { srp: "" } })).toBeNull();
    expect(readVariantSrp({ metadata: { srp: "not a number" } })).toBeNull();
  });

  it("uses a caller-supplied key, matching a store that renamed it", () => {
    expect(SRP_METADATA_KEY).toBe("srp");
    expect(readVariantSrp({ metadata: { rrp: "12" } }, "rrp")).toBe(12);
  });
});

describe("readVariantSrpMoney", () => {
  it("pairs the amount with the currency recorded beside it", () => {
    expect(readVariantSrpMoney({ metadata: { srp: "399.00", srp_currency: "pln" } })).toEqual({
      amount: 399,
      currency: "PLN",
    });
  });

  it("returns a null currency when none was recorded", () => {
    // A bare number is the honest rendering. Borrowing the store's default would
    // be inventing a fact, and this store sells in three currencies.
    expect(readVariantSrpMoney({ metadata: { srp: "399.00" } })).toEqual({
      amount: 399,
      currency: null,
    });
    expect(readVariantSrpMoney({ metadata: { srp: "399.00", srp_currency: "  " } })).toEqual({
      amount: 399,
      currency: null,
    });
    expect(readVariantSrpMoney({ metadata: { srp: "399.00", srp_currency: 978 } })).toEqual({
      amount: 399,
      currency: null,
    });
  });

  it("never labels a variant's amount with the product's currency", () => {
    // The amount and its currency are one fact. Reading them from different bags
    // is how a PLN figure ends up displayed as EUR.
    expect(
      readVariantSrpMoney({
        metadata: { srp: "350" },
        product: { metadata: { srp: "399", srp_currency: "EUR" } },
      }),
    ).toEqual({ amount: 350, currency: null });
  });

  it("takes both from the product when the variant carries no amount", () => {
    expect(
      readVariantSrpMoney({
        metadata: {},
        product: { metadata: { srp: "399", srp_currency: "EUR" } },
      }),
    ).toEqual({ amount: 399, currency: "EUR" });
  });

  it("returns null when there is no amount at all", () => {
    expect(readVariantSrpMoney({})).toBeNull();
    expect(readVariantSrpMoney({ metadata: { srp_currency: "PLN" } })).toBeNull();
  });

  it("derives the currency key from a renamed amount key", () => {
    expect(srpCurrencyKey()).toBe("srp_currency");
    expect(srpCurrencyKey("rrp")).toBe("rrp_currency");
    expect(readVariantSrpMoney({ metadata: { rrp: "12", rrp_currency: "usd" } }, "rrp")).toEqual({
      amount: 12,
      currency: "USD",
    });
  });
});

describe("formatAmount", () => {
  it("renders two fixed decimals, identically in every locale", () => {
    expect(formatAmount(365.31)).toBe("365.31");
    expect(formatAmount(0)).toBe("0.00");
    expect(formatAmount(1299)).toBe("1299.00");
  });
});
