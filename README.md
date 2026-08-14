# @zanreal/medusa-admin-kit

An **extensible catalogue list** for the Medusa v2 admin. The kit ships one admin
route - a table with **one row per product variant** - and a cross-plugin
**column registry**. Sibling plugins (Allegro, product-costs, ...) register their
own columns into that one table instead of each shipping a separate products
page.

It is two things in one package:

1. **An importable library.** `registerVariantColumn(def)`,
   `getRegisteredVariantColumns()` and the supporting types. Contributor plugins
   depend on this to add a column.
2. **A Medusa plugin.** It ships the admin `Catalog` route that renders the
   base columns plus every registered column.

---

## Why a parallel list

Medusa 2.18's admin SDK lets a plugin inject **widgets** into fixed zones
(`product.list.before`, `product.details.after`, ...) but it gives a plugin **no
way to add a column to the core products data table** - that table is not
extensible. So today every plugin that wants per-row state while browsing the
catalogue has to build its own full products page, and a store that installs
three such plugins ends up with three near-identical lists.

This kit owns **one** list that _is_ extensible. Each plugin contributes a column
definition; the kit renders them all in a single table, ordered by priority. The
stock admin products page keeps doing product CRUD; this route is the shared read
surface plugins can decorate.

The route lives at `/app/catalog` and adds a **Catalog** item to the sidebar,
deliberately separate from the stock admin's own `/app/products` page - it does
not replace or shadow it. The route path is just the folder name under
`src/admin/routes/`, so a fork can rename it (and the sidebar `label` in
`page.tsx`) to mount somewhere else without touching anything under
`src/registry/`.

---

## Why rows are variants

A row is a **variant**, not a product. This is the difference that makes the
table worth reading.

Stock, price, cost, an Allegro offer, a barcode: every one of those is a
property of a variant. When the row was a product, a column that owned
variant-level data had nowhere to put it except a roll-up, and roll-ups say
nothing useful. "12/13 costed" does not tell you what anything costs; "3 offers
/ 1 conflict" does not tell you which SKU is broken. One variant per row deletes
the whole category of problem: each cell has exactly one value to show.

Mechanically the table queries `GET /admin/product-variants` (with the parent
product pulled in on the same request via `fields`), so one API row is one table
row, `count` is a variant count and pagination is exact. Fetching a page of
products and flattening it client-side would give neither.

### Base columns

| Column      | What it shows for a variant row                                   |
| ----------- | ----------------------------------------------------------------- |
| (thumbnail) | The variant's image, falling back to the product's, and Medusa's own `Photo` placeholder when there is neither. |
| Product     | The parent product's title.                                       |
| Variant     | The variant's own title (its option combination).                 |
| SKU         | That one variant's SKU, or a muted "no sku".                      |
| Status      | The parent product's status badge.                                |
| Shop        | The variant's own price, with its currency.                       |
| SRP         | The recommended price from `metadata.srp`, falling back to the product's. |

There is no `handle` column: a URL slug is not something anyone scans a
catalogue by, and it belongs to the parent product, not the row.

### The money columns

Shop price and SRP are **base** columns, not contributed ones, because both are
core Medusa data that arrives with the row: the price set comes back under
`*prices` and the SRP under `metadata` / `product.metadata`, all on the one
`GET /admin/product-variants` request the table already makes. A page of 100
variants therefore renders both prices with **zero** extra round trips. Pushing
either into a plugin would mean re-fetching, per row, something that was already
in hand.

Two rules hold for every money cell, base or contributed:

- **A cell never invents a number.** Amounts reach the table in different
  shapes: a Medusa price `amount` is a `BigNumber` (a plain number over HTTP, a
  live instance or a raw `{ value, precision }` object on other paths), while
  `metadata.srp` is a bare string a store typed in. `readAmount` recognises each
  shape explicitly - a `BigNumber` through `valueOf()`, its public coercion,
  never through the trailing-underscore privates unless the object arrived
  without a prototype - and returns `null`, never `0`, for anything unreadable.
  Zero is a legitimate price, so "unreadable" has to stay distinguishable from
  "free".
- **A missing value is calm.** No price renders as a muted `-`, never a zero and
  never an error state. For a store where only part of the catalogue is listed
  for sale, "no price" is the correct answer for the rest of it.

The SRP is shown **without a currency**, because `metadata.srp` does not record
one. Labelling it with the shop price's currency would be asserting something
the data does not say; the cell states that on hover instead.

Both columns are right-aligned with `tabular-nums`, so decimal points line up
down the column and across the row. They sit at the end of the base columns so
that a contributed price column (`@zanreal/medusa-allegro` registers one) lands
immediately after them and the prices read as one block.

`readAmount`, `selectVariantPrice`, `readVariantSrp` and `formatAmount` are
exported, so a contributor rendering money into this table can read and format
it exactly the same way rather than re-deriving the rules.

### Clicking a row

A row opens **that variant**, at `/products/:product_id/variants/:variant_id`.
That route is the stock admin's own variant detail page - the dashboard's
product detail screen links its variant table to exactly the same path - so the
Catalog hands the user to the same screen the rest of the admin would, and the
breadcrumb there walks back up to the product. Linking to the product instead
would throw away the one thing the row identified. Cmd/Ctrl/middle-click opens
it in a new tab, matching the dashboard's own rows.

---

## Install

```bash
pnpm add @zanreal/medusa-admin-kit
```

Register the plugin so its admin route ships with your admin build:

```ts
// medusa-config.ts
module.exports = defineConfig({
  plugins: ["@zanreal/medusa-admin-kit"],
});
```

That is all a **host** needs. Everything below is for a plugin that wants to
**contribute a column**.

---

## The contributor contract

This is the load-bearing part. Follow it exactly and your column shows up; break
the one eval-order rule and it silently will not.

### 1. Depend on the kit

```jsonc
// your-plugin/package.json
{
  "dependencies": {
    "@zanreal/medusa-admin-kit": "^0.1.0",
  },
}
```

### 2. Register from the top level of an admin extension module

Create a widget in **your** plugin and call `registerVariantColumn` at **module
top level** - not inside the component, not in an effect, not in a lazily
imported helper:

```tsx
// your-plugin/src/admin/widgets/register-columns.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { registerVariantColumn } from "@zanreal/medusa-admin-kit";
import { Badge } from "@medusajs/ui";

// Runs once at admin boot. This is the contract.
registerVariantColumn({
  id: "allegro.offer_status", // namespace it to your plugin
  header: "Allegro",
  priority: 10, // lower renders first; default 0
  cell: (ctx) => {
    // ctx is typed: one variant, its SKU, and its parent product.
    return <Badge color={ctx.sku ? "green" : "grey"}>{ctx.sku ?? "-"}</Badge>;
  },
});

// A widget must default-export a component and declare a zone. This one renders
// nothing - registration is a module side effect, not tied to the zone showing.
const RegisterColumns = () => null;
export const config = defineWidgetConfig({ zone: "product.list.before" });
export default RegisterColumns;
```

That is the whole contract:

- **Import** `registerVariantColumn` from `@zanreal/medusa-admin-kit`.
- **Call** it at the **top level** of a file under `src/admin/widgets/` (or
  `src/admin/routes/`).
- Give the widget a **default export** and a **`zone`** so the admin build picks
  it up. The component may return `null`; it never has to render.

The kit deliberately ships **no demo column of its own**. It used to, and that
was a bug: the demo rendered the same "2 variants - SKU-1" string as a base
column, so a real store saw two columns saying the same thing. Example code
belongs in this README, not in the plugin bundle every store installs.

### The one eval-order rule

**The `registerVariantColumn` call must live at the top level of an admin
extension file (a widget or a route `page`).** Do not move it into a React
component body, a `useEffect`, an event handler, or a helper module that only
your route imports lazily.

Why this rule is exactly right, and not superstition:

- `medusa plugin:build` (and the host admin build) **statically import every
  widget and route** into generated `virtual:medusa/widgets` /
  `virtual:medusa/routes` modules, and the dashboard imports those at startup.
  A static import _evaluates_ the module. So a widget module's top-level code
  runs **once, at admin boot**, whether or not its zone is ever displayed and
  whether or not anyone navigates to your route.
- The kit's `Catalog` route reads the registry only **when it renders**, which
  requires navigating to it - strictly after boot. So every contributor that
  registered at boot is already present when the table is drawn. There is no
  race.
- Code that is _not_ an admin extension module (a plain helper, a component body,
  an effect) is only evaluated when something pulls it in at runtime, which may
  be after the table has rendered, or never. That is the failure mode the rule
  avoids.

---

## Why one registry, even across separately built plugins (dedupe)

Each plugin is built in isolation by `plugin:build`, which bundles its admin
extensions. For a registry shared across those bundles to work, they must all
read and write the **same** store.

The store is anchored on `globalThis` under a versioned `Symbol.for` key:

```
Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1")
```

- The happy path is that `@zanreal/medusa-admin-kit` resolves to a single module
  instance in the final admin bundle, so there is one store already.
- But correctness does **not** depend on that. Even if the bundler ends up with
  more than one copy of the kit module (a mis-declared dependency getting
  inlined, a version split), every copy's `getStore()` reads the **same**
  `globalThis[Symbol.for(...)]` object. One store, one set of columns.

This is why the contract does not ask you to get dependency externalization
perfect - the `globalThis` anchor makes double-instantiation harmless.

The key stays at **v1** even though the cell context changed shape when rows
became variants. Bumping it would create the very split it exists to prevent:
the route reading a v2 store while a plugin nobody has migrated yet wrote its
column into v1, and that column silently vanishing. See "Migrating from product
rows" below for what keeps an unmigrated column rendering instead.

---

## What the package ships (dual entry, and why)

`pnpm build` produces two entries under `.medusa/server/src/`, and the `exports`
map points each consumer at the right one:

| Entry        | Format   | Condition | Who reads it                                     |
| ------------ | -------- | --------- | ------------------------------------------------ |
| `index.js`   | CommonJS | `require` | The Medusa server, and any `require()` consumer. |
| `index.mjs`  | ESM      | `import`  | Bundlers, i.e. every admin build.                |
| `index.d.ts` | types    | `types`   | `tsc` in a contributor plugin.                   |

The ESM entry is not cosmetic; without it a contributor's column cannot ship.
`medusa plugin:build` compiles this package with `tsc` to CommonJS, and it
externalizes declared dependencies - so a contributor's built
`.medusa/server/src/admin/index.mjs` keeps a bare
`import { registerVariantColumn } from "@zanreal/medusa-admin-kit"`. The host
app's admin build (`medusa build` -> vite) declares no `rollupOptions.external`,
so it has to pull that import into the bundle. Vite's default
`build.commonjsOptions.include` is `[/node_modules/]`, which means a CommonJS
entry only survives when the package happens to sit under `node_modules`. As a
workspace package or a git submodule, rollup resolves through the symlink to a
real path outside `node_modules`, skips CommonJS interop, parses the CommonJS
entry as ESM, finds no named exports, and kills the whole admin build with
`"registerVariantColumn" is not exported by ".../src/index.js"`. Shipping real
ESM makes the import statically analyzable wherever the package lives.

`index.mjs` is a single self-contained bundle, so it is a second copy of the
registry code next to the CommonJS one (and next to the copy `plugin:build`
inlines into this package's own admin bundle). That is safe for exactly the
reason above: the store is on `globalThis`, never in module scope. Keep it that
way. `src/__tests__/built-entry.test.ts` asserts both halves against the real
build output - that the ESM entry exposes every public binding (including the
deprecated aliases, which an unmigrated plugin's bundle still imports by name)
as a static `export { ... }` a bundler with no CommonJS interop can read, and
that registering through one entry is visible through the other.

If a host's admin build instead fails with **`Rollup failed to resolve import
"@zanreal/medusa-admin-kit"`**, that is a different problem: the kit is not
installed anywhere the contributor plugin's built file can resolve it. Add it to
the host app's dependencies (or to the workspace) so the bare specifier resolves
from the plugin's real path on disk.

---

## Column API

```ts
interface VariantColumnDef<TProduct = CatalogProduct, TData = unknown> {
  /** Stable, unique, namespaced id. Re-registering the same id replaces it. */
  id: string;
  /** A string, or a render function for a custom header. */
  header: string | (() => ReactNode);
  /** Sort key among registered columns. Lower first; ties keep registration order. Default 0. */
  priority?: number;
  /** Renders the cell for one variant row. `async` is set only when `loadData` is. */
  cell: (ctx: VariantColumnCellContext<TProduct>, async?: VariantColumnAsyncState<TData>) => ReactNode;
  /** Optional async loader for a cell backed by a network call. See "Async cells" below. */
  loadData?: (ctx: VariantColumnCellContext<TProduct>) => Promise<TData>;
}
```

Every cell receives a typed context, built once per row:

```ts
interface VariantColumnCellContext<TProduct> {
  variant: { id: string; sku: string | null; title: string | null; thumbnail: string | null };
  variantId: string;
  sku: string | null;
  product: TProduct | null; // null only if the row was fetched without it
  productId: string | null;
}
```

`product` is nullable because a row can in principle be fetched without it; the
Catalog route always requests it, so in practice it is there.

### Async cells

Most columns key on data already in `ctx` and never need `loadData`. A column
backed by a network call - an Allegro offer lookup, a product-costs cost lookup -
sets `loadData` instead of doing the fetch inline in `cell`:

```tsx
registerVariantColumn({
  id: "allegro.offer_status",
  header: "Allegro",
  priority: 10,
  loadData: async (ctx) => (ctx.sku ? fetchOffer(ctx.sku) : null), // one variant, one lookup
  cell: (_ctx, async) => {
    if (!async || async.isLoading) {
      return <Text size="small">...</Text>; // skeleton; also the no-JS-yet render
    }
    if (async.error) {
      return (
        <Text className="text-ui-fg-error" size="small">
          -
        </Text>
      );
    }
    return <Badge>{async.data?.status ?? "-"}</Badge>;
  },
});
```

The base table renders immediately and never awaits `loadData` - each row
starts in `async.isLoading: true` and re-renders once the fetch settles, into
either `async.data` or `async.error`. `cell` is called with `async: undefined`
only for columns that never set `loadData`; a `loadData` column always gets a
defined `async`, so it never has to guess which shape it is in. If `cell`
throws - synchronously, or because it does not handle `async.error` and derefs
`async.data` while `undefined` - the kit catches it and renders an inline error
for that one cell only; it does not take down the row, the table, or any other
plugin's column. A plugin that is not installed never calls
`registerVariantColumn` at all, so its column, and any risk from it, simply
does not exist - there is nothing to degrade.

```ts
interface VariantColumnAsyncState<TData> {
  data: TData | undefined; // set once loadData resolves
  isLoading: boolean;
  error: unknown; // set if loadData rejected
}
```

### Registry functions

| Function                        | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `registerVariantColumn(def)`    | Add (or replace, by `id`) a column.               |
| `getRegisteredVariantColumns()` | All registered columns, sorted by `priority`.     |
| `hasVariantColumn(id)`          | Whether an id is registered.                      |
| `getVariantColumn(id)`          | One column by id, or `undefined`.                 |
| `unregisterVariantColumn(id)`   | Remove a column; returns whether one was removed. |
| `clearVariantColumns()`         | Remove all (test/HMR resets).                     |

Pure helpers are exported too: `buildVariantColumnContext`, `extractSkus`,
`normalizeVariant`, `resolveCatalogColumns`, `renderRegisteredCell`,
`variantDetailHref`, `unwrapClickedRow`, and the query mappers
`buildVariantListQuery` / `mapVariantListResponse`.

---

## Migrating from product rows

The registry has **one** context shape, and it is variant-shaped. It does not
accept a product-shaped column alongside it: a product-shaped cell in a
variant-row table can only render the same aggregate on every one of that
product's rows, which is the "12/13 costed" defect repeated thirteen times
rather than fixed once.

What that costs a contributor:

| Old                            | New                             | Note                                                                 |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------- |
| `registerProductColumn`        | `registerVariantColumn`         | Deprecated alias kept; identical function, same store.               |
| `getRegisteredProductColumns`  | `getRegisteredVariantColumns`   | Deprecated alias kept.                                               |
| `hasProductColumn` etc.        | `hasVariantColumn` etc.         | Deprecated aliases kept.                                             |
| `ProductColumnDef`             | `VariantColumnDef`              | Deprecated type alias kept.                                          |
| `ProductColumnCellContext`     | `VariantColumnCellContext`      | Deprecated type alias kept, but **reshaped** - see below.            |
| `ctx.skus`                     | `[ctx.sku]`                     | Still present, now this row's single SKU.                            |
| `ctx.firstSku`                 | `ctx.sku`                       | Still present, same value.                                           |
| `ctx.variantCount`             | always `1`                      | Still present. Any ratio built from it is `n/1`; drop the ratio.     |
| `ctx.variants`                 | `[ctx.variant]`                 | Still present, this row's single variant.                            |
| `ctx.product`                  | `ctx.product` (nullable)        | Now `TProduct \| null`, and it no longer carries a `variants` array. |
| `buildProductColumnContext`    | `buildVariantColumnContext`     | **Removed**, not aliased - it took a product and cannot be made coherent. |
| `resolveProductColumns`        | `resolveCatalogColumns`         | **Renamed**, no alias. Route plumbing, not contributor API.          |
| `BASE_PRODUCT_COLUMN_IDS`      | `BASE_CATALOG_COLUMN_IDS`       | **Renamed**, no alias. Contents changed too.                         |
| `PRODUCT_LIST_FIELDS` / `buildProductListQuery` / `mapProductListResponse` | `VARIANT_LIST_FIELDS` / `buildVariantListQuery` / `mapVariantListResponse` | **Renamed**, no alias. The table queries variants now. |

So a plugin that does nothing at all keeps its column: the registration alias
still works, and the old `ctx` fields still resolve - scoped to the row's one
variant, which is the correct behaviour. A `loadData` that queried
`ctx.skus` now looks up exactly this row's SKU.

What it should still do is delete its aggregation, because there is nothing left
to aggregate. Both first-party contributors did:

- **Allegro** (`@zanreal/medusa-allegro`) registers `allegro.offer_status`,
  now the state of the one offer mapped to this variant's SKU.
- **product-costs** (`@zanreal/medusa-product-costs`) registers
  `product-costs.cost`, now that variant's actual unit cost.

---

## Development

```bash
pnpm install
pnpm build           # plugin:build (server + admin bundle) then the ESM entry
pnpm test            # vitest: registry, context builder, query + column mapping,
                     # row links, and the built entry surface (needs pnpm build first)
pnpm typecheck       # tsc, server project
pnpm typecheck:admin # tsc, admin (browser) project
```

`pnpm build` runs `medusa plugin:build` and then `scripts/build-esm-entry.mjs`,
which emits `.medusa/server/src/index.mjs`. Run it before `pnpm test`, since the
built-entry test reads that output; `prepare` builds on install and CI builds
before it tests, so this only bites when you delete `.medusa/` by hand.

`react-router-dom` is a devDependency, never a runtime one: the admin bundler
externalizes it unconditionally and the host dashboard always provides it. It is
declared only so `tsc` can see `useNavigate` for the row-click handler.

The registry and its helpers are framework-free and unit-tested in Node; the
route and widget are typechecked against the real `@medusajs/ui` types and built
by `plugin:build`.

## License

MIT
