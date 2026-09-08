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

[Unreleased]: https://github.com/zanreal-labs/medusa-admin-kit/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.2.0
[0.1.1]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.1.1
[0.1.0]: https://github.com/zanreal-labs/medusa-admin-kit/releases/tag/v0.1.0
