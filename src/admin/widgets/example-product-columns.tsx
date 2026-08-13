import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { registerProductColumn } from "../../registry/product-columns";
import { EXAMPLE_VARIANT_SUMMARY_COLUMN } from "../../registry/example/variant-summary-column";

/**
 * Demo contributor: registers a column in the shared products table.
 *
 * This is the EXACT contract an external plugin follows, and it is why the call
 * lives at the top level of a widget module:
 *
 * - The admin build statically imports every widget into `virtual:medusa/widgets`,
 *   which the dashboard imports at boot. So this module - and therefore this
 *   `registerProductColumn` call - is evaluated once at admin boot, before the
 *   user can navigate anywhere. The widget component itself never has to render
 *   (it returns `null`); the registration is a module side effect, not tied to
 *   the injection zone ever being shown.
 * - The kit's Products route only reads the registry when it renders, which
 *   requires navigation and therefore happens strictly after boot. So the column
 *   is always present by the time the table is drawn.
 *
 * An external plugin writes the identical file, with one difference: it imports
 * from the published package instead of a relative path -
 *
 * ```ts
 * import { registerProductColumn } from "@zanreal/medusa-admin-kit"
 * ```
 *
 * Both resolve to the same registry: the store is anchored on a `globalThis`
 * `Symbol.for` key, so even if the bundler produces more than one copy of the
 * kit module they converge on one set of columns. See the README.
 */
registerProductColumn(EXAMPLE_VARIANT_SUMMARY_COLUMN);

const ExampleProductColumnsWidget = () => null;

export const config = defineWidgetConfig({
  zone: "product.list.before",
});

export default ExampleProductColumnsWidget;
