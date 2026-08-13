# @zanreal/medusa-admin-kit

An **extensible products list** for the Medusa v2 admin. The kit ships one admin
route - a products table - and a cross-plugin **column registry**. Sibling
plugins (Allegro, product-costs, ...) register their own columns into that one
table instead of each shipping a separate products page.

It is two things in one package:

1. **An importable library.** `registerProductColumn(def)`,
   `getRegisteredProductColumns()` and the supporting types. Contributor plugins
   depend on this to add a column.
2. **A Medusa plugin.** It ships the admin `Products` route that renders the
   base columns plus every registered column.

---

## Why a parallel products list

Medusa 2.18's admin SDK lets a plugin inject **widgets** into fixed zones
(`product.list.before`, `product.details.after`, ...) but it gives a plugin **no
way to add a column to the core products data table** - that table is not
extensible. So today every plugin that wants per-product state while browsing
the catalogue has to build its own full products page, and a store that installs
three such plugins ends up with three near-identical products lists.

This kit owns **one** products list that _is_ extensible. Each plugin contributes
a column definition; the kit renders them all in a single table, ordered by
priority. The stock admin products page keeps doing product CRUD; this route is
the shared read surface plugins can decorate.

The route lives at `/app/catalog` and adds a **Catalog** item to the sidebar,
deliberately separate from the stock admin's own `/app/products` page - it does
not replace or shadow it. A store gets both: the stock Products page for core
product CRUD, and Catalog as the shared, extensible read surface plugins
decorate. The route path is just the folder name under `src/admin/routes/`, so
a fork can rename it (and the sidebar `label` in `page.tsx`) to mount somewhere
else without touching anything under `src/registry/`.

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

Create a widget in **your** plugin and call `registerProductColumn` at **module
top level** - not inside the component, not in an effect, not in a lazily
imported helper:

```tsx
// your-plugin/src/admin/widgets/register-columns.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { registerProductColumn } from "@zanreal/medusa-admin-kit";
import { Badge } from "@medusajs/ui";

// Runs once at admin boot. This is the contract.
registerProductColumn({
  id: "allegro.sync_status", // namespace it to your plugin
  header: "Allegro",
  priority: 10, // lower renders first; default 0
  cell: (ctx) => {
    // ctx is typed: product row + normalized variants/skus.
    const listed = ctx.skus.length > 0;
    return <Badge color={listed ? "green" : "grey"}>{listed ? "listed" : "-"}</Badge>;
  },
});

// A widget must default-export a component and declare a zone. This one renders
// nothing - registration is a module side effect, not tied to the zone showing.
const RegisterColumns = () => null;
export const config = defineWidgetConfig({ zone: "product.list.before" });
export default RegisterColumns;
```

That is the whole contract:

- **Import** `registerProductColumn` from `@zanreal/medusa-admin-kit`.
- **Call** it at the **top level** of a file under `src/admin/widgets/` (or
  `src/admin/routes/`).
- Give the widget a **default export** and a **`zone`** so the admin build picks
  it up. The component may return `null`; it never has to render.

### The one eval-order rule

**The `registerProductColumn` call must live at the top level of an admin
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
- The kit's `Products` route reads the registry only **when it renders**, which
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
`import { registerProductColumn } from "@zanreal/medusa-admin-kit"`. The host
app's admin build (`medusa build` -> vite) declares no `rollupOptions.external`,
so it has to pull that import into the bundle. Vite's default
`build.commonjsOptions.include` is `[/node_modules/]`, which means a CommonJS
entry only survives when the package happens to sit under `node_modules`. As a
workspace package or a git submodule, rollup resolves through the symlink to a
real path outside `node_modules`, skips CommonJS interop, parses the CommonJS
entry as ESM, finds no named exports, and kills the whole admin build with
`"registerProductColumn" is not exported by ".../src/index.js"`. Shipping real
ESM makes the import statically analyzable wherever the package lives.

`index.mjs` is a single self-contained bundle, so it is a second copy of the
registry code next to the CommonJS one (and next to the copy `plugin:build`
inlines into this package's own admin bundle). That is safe for exactly the
reason above: the store is on `globalThis`, never in module scope. Keep it that
way. `src/__tests__/built-entry.test.ts` asserts both halves against the real
build output - that the ESM entry exposes every public binding as a static
`export { ... }` a bundler with no CommonJS interop can read, and that
registering through one entry is visible through the other.

If a host's admin build instead fails with **`Rollup failed to resolve import
"@zanreal/medusa-admin-kit"`**, that is a different problem: the kit is not
installed anywhere the contributor plugin's built file can resolve it. Add it to
the host app's dependencies (or to the workspace) so the bare specifier resolves
from the plugin's real path on disk.

---

## Column API

```ts
interface ProductColumnDef<TProduct = ProductColumnProduct, TData = unknown> {
  /** Stable, unique, namespaced id. Re-registering the same id replaces it. */
  id: string;
  /** A string, or a render function for a custom header. */
  header: string | (() => ReactNode);
  /** Sort key among registered columns. Lower first; ties keep registration order. Default 0. */
  priority?: number;
  /** Renders the cell for one product row. `async` is set only when `loadData` is. */
  cell: (ctx: ProductColumnCellContext<TProduct>, async?: ProductColumnAsyncState<TData>) => ReactNode;
  /** Optional async loader for a cell backed by a network call. See "Async cells" below. */
  loadData?: (ctx: ProductColumnCellContext<TProduct>) => Promise<TData>;
}
```

Every cell receives a typed context, built once per row so you never re-derive
SKUs:

```ts
interface ProductColumnCellContext<TProduct> {
  product: TProduct; // the row from GET /admin/products
  variants: { id: string; sku: string | null; title: string | null }[];
  skus: string[]; // non-empty, de-duplicated, in order
  firstSku: string | null;
  variantCount: number;
}
```

The products API is queried with variant `id`, `title` and `sku` in `fields`, so
columns can key on SKU without a second round-trip.

### Async cells

Most columns key on data already in `ctx` (SKUs, variant count) and never need
`loadData`. A column backed by a network call - an Allegro offer-status lookup,
a product-costs margin lookup - sets `loadData` instead of doing the fetch
inline in `cell`:

```tsx
registerProductColumn({
  id: "allegro.offer_status",
  header: "Allegro",
  priority: 10,
  loadData: async (ctx) => fetchOfferStatus(ctx.skus), // aggregate variant -> product here
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
    return <Badge>{async.data}</Badge>; // e.g. "3 offers / 1 conflict"
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
`registerProductColumn` at all, so its column, and any risk from it, simply
does not exist - there is nothing to degrade.

```ts
interface ProductColumnAsyncState<TData> {
  data: TData | undefined; // set once loadData resolves
  isLoading: boolean;
  error: unknown; // set if loadData rejected
}
```

### Registry functions

| Function                        | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `registerProductColumn(def)`    | Add (or replace, by `id`) a column.               |
| `getRegisteredProductColumns()` | All registered columns, sorted by `priority`.     |
| `hasProductColumn(id)`          | Whether an id is registered.                      |
| `getProductColumn(id)`          | One column by id, or `undefined`.                 |
| `unregisterProductColumn(id)`   | Remove a column; returns whether one was removed. |
| `clearProductColumns()`         | Remove all (test/HMR resets).                     |

Pure helpers are exported too: `buildProductColumnContext`, `extractSkus`,
`normalizeVariant`, `resolveProductColumns`, `renderRegisteredCell`, and the
query mappers `buildProductListQuery` / `mapProductListResponse`.

---

## How the ZanReal plugins register

- **Allegro** (`@zanreal/medusa-allegro`) registers an `allegro.offer_status`
  column - a per-row badge aggregating each SKU's Allegro offer state to the
  product level (e.g. "3 offers / 1 conflict") - via `loadData`, from a widget
  in its own `src/admin/widgets/`.
- **product-costs** (`@zanreal/medusa-product-costs`) registers a
  `product-costs.margin` column showing the cost/margin it owns, also via
  `loadData`.

Both are async columns: the lookup is a network call keyed by SKU, so neither
blocks the base table's render.

Each ships one small registration widget; neither builds a competing products
list.

---

## Development

```bash
pnpm install
pnpm build           # plugin:build (server + admin bundle) then the ESM entry
pnpm test            # vitest: registry, context builder, query + column mapping,
                     # and the built entry surface (needs pnpm build first)
pnpm typecheck       # tsc, server project
pnpm typecheck:admin # tsc, admin (browser) project
```

`pnpm build` runs `medusa plugin:build` and then `scripts/build-esm-entry.mjs`,
which emits `.medusa/server/src/index.mjs`. Run it before `pnpm test`, since the
built-entry test reads that output; `prepare` builds on install and CI builds
before it tests, so this only bites when you delete `.medusa/` by hand.

The registry and its helpers are framework-free and unit-tested in Node; the
route and widget are typechecked against the real `@medusajs/ui` types and built
by `plugin:build`.

## License

MIT
