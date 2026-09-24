# Changelog

All notable changes to `@zanreal/medusa-admin-kit` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). A version
reaches npm only through a GitHub Release, so the dates below are publish dates on the
registry, not merge dates on `main` - see [Releasing](./README.md#releasing).

This package is a contract between sibling plugins. Changes to the registry API are
breaking for every plugin that registers a column, so they are called out as such.

## [Unreleased]

Nothing yet.

## [0.3.0] - 2026-09-24

### Changed

- **Breaking: the `@medusajs/*` peers now pin 2.21.1.** 0.2.x pinned 2.18.0 exactly, which npm
  refuses to install next to a newer Medusa. Stay on 0.2.x with Medusa 2.18; take 0.3.0 with 2.21.1.
- **Built and tested against Medusa 2.21.1** (was 2.18.0), with the admin toolchain Medusa 2.19
  requires: Vite 7 and, where used, React Router 7. `react-i18next` and `i18next` deliberately stay
  on the majors the Medusa dashboard itself ships (13 and 23): admin extensions share the host's
  i18n instance, and a second major would give them one of their own. Install alongside Medusa
  2.21.1; Node ^20.19 or ^22.12 is required from Medusa 2.19 on.

## [0.2.1] - 2026-09-08

### Added

- This changelog, shipped in the published tarball.

### Note

- This package is deliberately **not** listed in the Medusa integrations directory.
  That directory covers plugins integrating a third-party service, and this one
  integrates nothing - it is a registry that sibling plugins render into.

## [0.2.0] - 2026-09-01

### Added

- **Stock level as a base column** in the Catalog table. Base columns are provided by the
  kit itself rather than registered by a sibling plugin, so every store that installs the
  kit gets it without wiring anything.

## [0.1.1] - 2026-08-27

### Changed

- `homepage` points at the documentation site rather than the repository, so the npm
  listing links to the page written for a reader instead of to a file tree.

## [0.1.0] - 2026-08-26

First public release. MIT, published from CI with npm provenance.

### Added

- **Cross-plugin product column registry.** Sibling plugins register their own columns and
  they all render in one products table, instead of each plugin shipping a separate admin
  page. This is the whole point of the package: a store running four ZanReal plugins gets
  one Catalog screen, not four.
- **Catalog route** with one row per variant, async cell support, and the shop price, the
  SRP and its currency as base columns.
- **ESM entry**, so a contributor's admin bundle can import the registry.
- `prepare` script, so a git-installed build works.
- Admin UI in English and Polish, with the sidebar label resolved through i18n.

[Unreleased]: https://github.com/zanreal-labs/medusa-admin-kit/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/zanreal-labs/medusa-admin-kit/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.2.0
[0.1.1]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.1.1
[0.1.0]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.1.0
