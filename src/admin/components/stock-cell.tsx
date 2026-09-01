import { Text } from "@medusajs/ui";
import { isVariantOutOfStock } from "../../registry/stock";
import type { VariantStock } from "../../registry/stock";

/**
 * One variant's stock level in the Catalog table.
 *
 * Right-aligned and `tabular-nums` for the same reason the money cells are:
 * a column of quantities is only scannable when the digits line up. It stops
 * short of {@link MoneyCell} on purpose - a count carries no currency, so
 * borrowing that component would mean rendering an always-empty currency slot
 * beside every number.
 *
 * A non-positive tracked quantity is the one value an operator opens this
 * column for, so it is the only one that gets colour. Everything the store is
 * not counting renders as the same muted dash a missing price does: absent, not
 * alarming, and never `0`.
 */
export function StockCell({
  stock,
  title,
}: {
  stock: VariantStock;
  /** Native tooltip, used to say why a row shows no quantity. */
  title?: string;
}) {
  if (stock.state !== "tracked") {
    return (
      <Text className="text-ui-fg-muted" size="small" title={title}>
        -
      </Text>
    );
  }

  return (
    <span className="flex w-full justify-end tabular-nums" title={title}>
      <Text
        className={isVariantOutOfStock(stock) ? "text-ui-fg-error" : undefined}
        size="small"
      >
        {stock.quantity}
      </Text>
    </span>
  );
}
