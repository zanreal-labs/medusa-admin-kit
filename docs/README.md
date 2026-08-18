# docs/

The published documentation for `@zanreal/medusa-admin-kit`.

These pages are the source of what renders at
<https://zanreal.com/docs/oss/medusa-admin-kit>. The marketing site clones this
repository at build time and copies this directory into its own content tree, so
a change merged here is what the site ships on its next deploy. Nothing is
maintained by hand on the other side.

## Layout

| File | Purpose |
| --- | --- |
| `index.en.mdx`, `index.pl.mdx` | Overview: what the package is, why it exists, how a host installs it. |
| `catalog.en.mdx`, `catalog.pl.mdx` | The Catalog table: variant rows, base columns, the money rules. |
| `columns.en.mdx`, `columns.pl.mdx` | The contributor contract another plugin follows to register a column. |
| `api.en.mdx`, `api.pl.mdx` | Reference for every export. |
| `meta.json`, `meta.pl.json` | Sidebar title, description and page order, per locale. |

This `README.md` is deliberately **not** copied by the sync. It explains the
directory to someone browsing GitHub; it is not a page on the site.

## Conventions

- **Every page exists in both locales**, suffixed `.en.mdx` and `.pl.mdx`.
- **Each locale is written from the code, not translated from the other.** The
  two versions make the same argument and are expected to differ in examples and
  emphasis.
- **Cross-links between pages are relative** and point at the file, for example
  `[API reference](./api.en.mdx)`. That resolves when browsing this directory on
  GitHub, and the site's sync rewrites it to a site route on the way in. The
  locale is taken from the link target, so `./api.pl.mdx` lands on the Polish
  page.
- **No em or en dashes.** Use a spaced hyphen for a parenthetical.
