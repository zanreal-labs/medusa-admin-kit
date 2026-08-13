import type { ProductColumnDef } from "../types";

/**
 * Example column that proves the registry pipeline end to end.
 *
 * It is intentionally kept as a plain, framework-free definition: the cell
 * returns a string derived purely from the column context, so the exact same
 * definition an external plugin would ship can also be asserted in a Node test
 * without a React renderer. The `src/admin/widgets/example-product-columns.tsx`
 * widget registers this at admin boot, exactly the way a contributor registers
 * their own column.
 *
 * Real plugins will return richer cells (badges, links, money) - see the README.
 */
export const EXAMPLE_VARIANT_SUMMARY_COLUMN: ProductColumnDef = {
  cell: (ctx) => {
    const variantLabel = `${ctx.variantCount} ${ctx.variantCount === 1 ? "variant" : "variants"}`;
    return ctx.firstSku ? `${variantLabel} - ${ctx.firstSku}` : variantLabel;
  },
  header: "Variants (example)",
  id: "medusa-admin-kit.example.variant_summary",
  priority: 1000,
};
