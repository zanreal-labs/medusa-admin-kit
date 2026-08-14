import { Text } from "@medusajs/ui";
import { formatAmount } from "../../registry/money";
import type { CatalogMoney } from "../../registry/money";

/**
 * One money value in the Catalog table.
 *
 * Three of the table's columns are prices, so they are only useful if they read
 * as one block. This component is what makes that true: every amount is
 * rendered with `tabular-nums` and two fixed decimals, so digits occupy the
 * same width in every row and the decimal points line up down the column and
 * across the row. The currency sits next to the amount in the muted, smaller
 * style, because with three currencies repeated on every row the codes would
 * otherwise compete with the numbers they qualify.
 *
 * A missing value renders as a muted dash. It is never `0` and never an error:
 * for this catalogue a variant with no price is a variant that is not listed
 * for sale, which is a normal, correct state that an operator should be able to
 * skim past rather than be alarmed by.
 */
export function MoneyCell({
  money,
  otherCount = 0,
  title,
}: {
  money: CatalogMoney | null;
  /** Other values this cell is not showing, surfaced as a muted `+N`. */
  otherCount?: number;
  /** Native tooltip, used to state where a currency-less amount comes from. */
  title?: string;
}) {
  if (!money) {
    return (
      <Text className="text-ui-fg-muted" size="small" title={title}>
        -
      </Text>
    );
  }

  return (
    <span className="flex items-baseline gap-x-1 tabular-nums" title={title}>
      <Text size="small">{formatAmount(money.amount)}</Text>
      {money.currency ? (
        <Text className="text-ui-fg-muted" size="xsmall">
          {money.currency}
        </Text>
      ) : null}
      {otherCount > 0 ? (
        <Text className="text-ui-fg-muted" size="xsmall">
          {`+${otherCount}`}
        </Text>
      ) : null}
    </span>
  );
}
