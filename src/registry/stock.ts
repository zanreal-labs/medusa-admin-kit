/**
 * Reading the stock level a Catalog row carries.
 *
 * `GET /admin/product-variants` computes this figure itself: asking for
 * `inventory_quantity` in `fields` makes the route strip that field from the
 * graph query, run the query, and then wrap the result with
 * `getTotalVariantAvailability`, which is the sum across every stock location.
 * So the number arrives on the row the table already fetched and costs no extra
 * request - the same reason the shop price and the SRP are base columns.
 *
 * The catch, and the whole reason this module exists rather than a bare
 * `row.inventory_quantity` read at the cell: **that wrapper skips any variant
 * whose `manage_inventory` is false**, so such a row never gets the property at
 * all. An untracked variant and a variant with nothing left in stock therefore
 * arrive looking identical unless `manage_inventory` is read alongside the
 * quantity. Collapsing the two is not a cosmetic slip - "0 in stock" is the one
 * value an operator scans this column for, and painting it onto every
 * made-to-order or digital variant would make the column worse than absent.
 *
 * Hence three outcomes, never two, and never a defaulted `0`:
 *
 * - `tracked` - Medusa manages inventory for this variant and reported a
 *   quantity. This is the only case that carries a number.
 * - `untracked` - `manage_inventory` is false. There is no quantity to show,
 *   because nobody is counting.
 * - `unknown` - inventory is managed but no quantity came back, which in
 *   practice means the caller did not request `inventory_quantity`. Kept
 *   distinct so a misconfigured query shows as a gap rather than as stock.
 *
 * Pure and framework-free, so the rules are unit-tested without a dashboard.
 */

/** What the stock column knows about one variant row. */
export type VariantStock =
  | { state: "tracked"; quantity: number }
  | { state: "untracked" }
  | { state: "unknown" };

/** The slice of a variant row this read touches. */
interface StockRowLike {
  inventory_quantity?: number | null;
  manage_inventory?: boolean | null;
}

/**
 * Classify one row's stock level.
 *
 * A non-finite quantity is treated as absent rather than coerced: `NaN` or a
 * string that failed to parse upstream must not become a number an operator
 * would restock against.
 */
export function readVariantStock(row: StockRowLike | null | undefined): VariantStock {
  if (!row) {
    return { state: "unknown" };
  }
  // Explicitly false, not merely falsy. `undefined` means the field was not
  // requested, which is the `unknown` case below - a different fact from a
  // store having switched inventory management off for this variant.
  if (row.manage_inventory === false) {
    return { state: "untracked" };
  }
  const quantity = row.inventory_quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    return { state: "unknown" };
  }
  return { quantity, state: "tracked" };
}

/**
 * Whether a resolved stock level is one an operator needs to act on.
 *
 * Only a tracked, non-positive quantity qualifies. An untracked or unresolved
 * row is not "out of stock" and must not be coloured as though it were.
 */
export function isVariantOutOfStock(stock: VariantStock): boolean {
  return stock.state === "tracked" && stock.quantity <= 0;
}
