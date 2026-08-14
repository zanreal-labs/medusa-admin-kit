/**
 * Reading and rendering the money a Catalog row carries.
 *
 * Two of the three prices the table shows come straight off the variant row the
 * kit already fetches, and they arrive in two completely different shapes:
 *
 * - the **shop price** is a Medusa price, whose `amount` is a `BigNumber` -
 *   over HTTP it lands as a plain number, but the same field read through other
 *   paths is a live instance, a raw `{ value, precision }` object, or a
 *   flattened one that lost its accessors;
 * - the **SRP** is a bare amount a store typed into `metadata.srp`, i.e. a
 *   string. A string amount is not a `BigNumber` and must not be read as one.
 *
 * So every read goes through {@link readAmount}, which recognises each shape
 * explicitly and returns `null` - never `0` - for anything it cannot read. Zero
 * is a legitimate price, so "unreadable" has to stay distinguishable from
 * "free" all the way to the cell, which renders the null as a muted dash.
 *
 * Pure and framework-free, so all of it is unit-tested without a dashboard.
 */

/** The metadata key the SRP is stored under by default. */
export const SRP_METADATA_KEY = "srp";

/** An amount together with the currency it is denominated in. */
export interface CatalogMoney {
  amount: number;
  /**
   * Uppercase ISO code, or `null` when the source stores a bare amount with no
   * currency of its own (which is exactly what `metadata.srp` is).
   */
  currency: string | null;
}

/**
 * The public surface a Medusa `BigNumber` is read through.
 *
 * Declared structurally rather than importing the class: this module is pure so
 * its rules can be asserted without the framework, and an amount also has to
 * survive read paths that hand back a plain object instead of a live instance.
 */
interface BigNumberLike {
  /** Public getter. Its presence is what identifies an object as a BigNumber. */
  numeric?: unknown;
  /** Public getter, `{ value, precision }`. */
  raw?: unknown;
  valueOf?: () => unknown;
}

/** The `{ value, precision }` shape, whether bare or held by a BigNumber. */
function rawValueOf(raw: unknown): number | string | undefined {
  if (typeof raw !== "object" || raw === null || !("value" in raw)) {
    return undefined;
  }
  const inner = (raw as { value: unknown }).value;
  if (typeof inner === "number" || typeof inner === "string") {
    return inner;
  }
  return undefined;
}

/**
 * A number or a numeric string to a finite number, or `null`.
 *
 * `Number` rather than `Number.parseFloat`, because `parseFloat("365 PLN")` is
 * `365`: it stops at the first character it cannot use and silently drops the
 * rest, which is how a malformed field becomes a plausible-looking amount. The
 * empty string is rejected up front, since `Number("")` is `0` and a blank
 * metadata value means "not set", not "free".
 */
function toFiniteNumber(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read an amount out of whatever shape its source stores it in.
 *
 * A `BigNumber` instance is read through `valueOf()`, which is the class's own
 * public coercion contract - `toJSON()`, `[Symbol.toPrimitive]` and the
 * `numeric` getter all resolve to the same number, and `numeric` is what
 * `valueOf()` delegates to. The private `numeric_` / `raw_` fields are consulted
 * only as a last resort, for an instance that lost its prototype crossing a
 * serialization boundary: a trailing underscore is not a contract, and
 * preferring it over `valueOf()` would mean re-deriving a number the class
 * already derives.
 *
 * Blind coercion is deliberately avoided: `Number([])` is `0` and `Number({})`
 * is `NaN`, so `Number(anything)` would turn junk into an amount. Each shape is
 * recognised on its own.
 *
 * @returns The amount in major units, or `null` when the value is absent or
 * unreadable. Never `0` as a stand-in for either.
 */
export function readAmount(value?: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" || typeof value === "string") {
    return toFiniteNumber(value);
  }
  if (typeof value !== "object") {
    return null;
  }

  // A live BigNumber instance, read through its public accessors.
  const candidate = value as BigNumberLike;
  const raw = rawValueOf(candidate.raw);
  if (typeof candidate.numeric === "number" || raw !== undefined) {
    const coerced = candidate.valueOf?.();
    if (typeof coerced === "number" || typeof coerced === "string") {
      return toFiniteNumber(coerced);
    }
    return raw === undefined ? null : toFiniteNumber(raw);
  }

  // A bare `BigNumberRawValue`, e.g. the column as the DAL hands it over.
  const bare = rawValueOf(value);
  if (bare !== undefined) {
    return toFiniteNumber(bare);
  }

  // Last resort: a BigNumber flattened into a plain object keeps the private
  // fields and loses every accessor above. `raw_` first, because that is the
  // full-precision value the `numeric` getter itself prefers.
  const detached = value as { numeric_?: unknown; raw_?: unknown };
  const detachedRaw = rawValueOf(detached.raw_);
  if (detachedRaw !== undefined) {
    return toFiniteNumber(detachedRaw);
  }
  if (typeof detached.numeric_ === "number") {
    return toFiniteNumber(detached.numeric_);
  }

  return null;
}

/**
 * One entry of a variant's `prices` array, reduced to what picking a price
 * needs. `HttpTypes.AdminPrice` is structurally assignable to this.
 *
 * `amount` is deliberately `unknown`: see {@link readAmount} for why it cannot
 * be trusted to be a number even where the published type says so.
 */
export interface CatalogPrice {
  amount?: unknown;
  currency_code?: string | null;
  min_quantity?: number | null;
  max_quantity?: number | null;
  /** Region / customer-group scoping, when the price is not the plain one. */
  rules?: Record<string, unknown> | null;
}

/** The price a cell shows, plus how many it is not showing. */
export interface VariantPriceSelection {
  price: CatalogMoney;
  /**
   * How many other readable prices the variant has. Rendered as a muted `+N`
   * so a second currency or a quantity tier is never silently hidden behind
   * the one number in the cell.
   */
  otherCount: number;
}

/** Whether a price is the plain per-unit one rather than a scoped or tiered one. */
function isPlainPrice(price: CatalogPrice): boolean {
  const hasRules = Object.keys(price.rules ?? {}).length > 0;
  return !hasRules && price.min_quantity === null && price.max_quantity === null;
}

/**
 * Pick the one price a variant's shop-price cell shows.
 *
 * A variant's price set can hold several prices: one per currency, plus
 * region- or customer-group-scoped ones and quantity tiers. The cell has room
 * for one, so the plain per-unit prices are preferred and the lowest currency
 * code wins the tie - a rule, not a guess, so the same variant always shows the
 * same number. When a variant has *only* scoped or tiered prices, those are
 * used rather than rendering a dash: the variant does have a price, and saying
 * it does not would be the bigger lie.
 *
 * Returns `null` only when there is genuinely nothing readable, which for this
 * store is the correct and common state - a variant that is not listed on
 * Allegro has no price, and that is not an error.
 */
export function selectVariantPrice(
  prices?: readonly CatalogPrice[] | null,
): VariantPriceSelection | null {
  if (!prices || prices.length === 0) {
    return null;
  }

  const readable = prices.flatMap((price): { money: CatalogMoney; plain: boolean }[] => {
    const amount = readAmount(price.amount);
    if (amount === null) {
      return [];
    }
    const currency = typeof price.currency_code === "string" ? price.currency_code : null;
    return [
      {
        money: { amount, currency: currency ? currency.toUpperCase() : null },
        plain: isPlainPrice(price),
      },
    ];
  });
  if (readable.length === 0) {
    return null;
  }

  const plain = readable.filter((entry) => entry.plain);
  const candidates = plain.length > 0 ? plain : readable;
  const chosen = candidates.toSorted((a, b) =>
    (a.money.currency ?? "").localeCompare(b.money.currency ?? ""),
  )[0];

  return { otherCount: readable.length - 1, price: chosen.money };
}

/** The metadata bags an SRP is looked up in, variant first. */
export interface SrpSource {
  metadata?: Record<string, unknown> | null;
  product?: { metadata?: Record<string, unknown> | null } | null;
}

/**
 * Read a variant's SRP out of its metadata, falling back to its product's.
 *
 * The fallback is not incidental: a store that sets one recommended price for a
 * whole product should not have to repeat it on every variant, and the server
 * side that consumes this number (the Allegro price sync's ceiling) reads it
 * with exactly the same variant-then-product precedence. A column that skipped
 * the fallback would show a dash for a variant whose SRP is very much in use.
 *
 * The value is a **bare amount**: `metadata.srp` carries no currency, so the
 * result is a number and the cell is responsible for not inventing one.
 */
export function readVariantSrp(row: SrpSource, key: string = SRP_METADATA_KEY): number | null {
  return readAmount(row.metadata?.[key]) ?? readAmount(row.product?.metadata?.[key]);
}

/**
 * An amount as the table renders it: fixed two decimals, no locale grouping.
 *
 * `toFixed` rather than `Intl.NumberFormat` on purpose. The point of these
 * columns is comparing three prices for the same row and scanning one price
 * down the page, which needs every cell to have the decimal point in the same
 * place and to mean the same thing in every browser. A locale-dependent
 * separator would make the same catalogue read differently per operator, and
 * with `tabular-nums` on the cell the digits already line up without grouping.
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
