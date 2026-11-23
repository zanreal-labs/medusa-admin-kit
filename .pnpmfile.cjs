// typescript-eslint and @medusajs/eslint-plugin (used by `medusa lint`) need the
// TypeScript compiler API, which TypeScript 7 does not ship. Make these
// packages use the TS 6 port instead of the root typescript peer.
const TS6 = "npm:@typescript/typescript6@^6.0.2"
const NEEDS_TS6 = [
  "@typescript-eslint/parser",
  "@typescript-eslint/utils",
  "@typescript-eslint/typescript-estree",
  "@typescript-eslint/project-service",
  "@typescript-eslint/tsconfig-utils",
  "ts-api-utils",
  "@medusajs/eslint-plugin",
]

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (NEEDS_TS6.includes(pkg.name)) {
        if (pkg.peerDependencies) delete pkg.peerDependencies.typescript
        if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript
        pkg.dependencies = { ...pkg.dependencies, typescript: TS6 }
      }
      return pkg
    },
  },
}
