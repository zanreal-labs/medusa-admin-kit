import { beforeEach, describe, expect, it } from "vitest";
import { buildProductColumnContext } from "../context";
import { EXAMPLE_VARIANT_SUMMARY_COLUMN } from "../example/variant-summary-column";
import {
  clearProductColumns,
  getRegisteredProductColumns,
  registerProductColumn,
} from "../product-columns";
import type { ProductColumnProduct } from "../types";

/**
 * Exercises the full contributor pipeline the same way the admin runtime does:
 * register through the public API (as the demo widget does at boot), pull the
 * ordered columns (as the route does when it renders), then run a cell against a
 * built context (as the DataTable does per row). This is the kit's integration
 * surface without needing a live dashboard.
 */
describe("registry integration (demo column pipeline)", () => {
  beforeEach(() => {
    clearProductColumns();
  });

  it("registers the example column through the public API and renders its cell", () => {
    // Exactly what src/admin/widgets/example-product-columns.tsx does at boot.
    registerProductColumn(EXAMPLE_VARIANT_SUMMARY_COLUMN);

    const columns = getRegisteredProductColumns();
    expect(columns.map((c) => c.id)).toContain("medusa-admin-kit.example.variant_summary");

    const product: ProductColumnProduct = {
      id: "prod_1",
      title: "Boots",
      variants: [
        { id: "v1", sku: "BOOT-1", title: "40" },
        { id: "v2", sku: "BOOT-2", title: "41" },
      ],
    };
    const ctx = buildProductColumnContext(product);
    const rendered = EXAMPLE_VARIANT_SUMMARY_COLUMN.cell(ctx);
    expect(rendered).toBe("2 variants - BOOT-1");
  });

  it("renders the singular, no-sku case", () => {
    const ctx = buildProductColumnContext({
      id: "prod_2",
      variants: [{ id: "v1", title: "only" }],
    });
    expect(EXAMPLE_VARIANT_SUMMARY_COLUMN.cell(ctx)).toBe("1 variant");
  });

  it("orders contributed columns after each other by priority", () => {
    // Two 'plugins' registering columns plus the kit's example column.
    registerProductColumn({
      cell: (ctx) => ctx.firstSku ?? "-",
      header: "Allegro",
      id: "allegro.sync_status",
      priority: 10,
    });
    registerProductColumn({
      cell: () => "42%",
      header: "Margin",
      id: "product-costs.margin",
      priority: 20,
    });
    registerProductColumn(EXAMPLE_VARIANT_SUMMARY_COLUMN); // priority 1000

    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual([
      "allegro.sync_status",
      "product-costs.margin",
      "medusa-admin-kit.example.variant_summary",
    ]);
  });
});
