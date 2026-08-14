import { beforeEach, describe, expect, it } from "vitest";
import type { VariantColumnDef } from "../types";
import {
  clearVariantColumns,
  getRegisteredProductColumns,
  getRegisteredVariantColumns,
  getVariantColumn,
  hasProductColumn,
  hasVariantColumn,
  registerProductColumn,
  registerVariantColumn,
  unregisterVariantColumn,
} from "../variant-columns";

const column = (id: string, priority?: number): VariantColumnDef => ({
  cell: () => id,
  header: id,
  id,
  priority,
});

describe("catalog column registry", () => {
  beforeEach(() => {
    clearVariantColumns();
  });

  it("registers and returns a column", () => {
    registerVariantColumn(column("a"));
    expect(hasVariantColumn("a")).toBe(true);
    expect(getVariantColumn("a")?.id).toBe("a");
    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["a"]);
  });

  it("dedupes by id - last registration wins", () => {
    registerVariantColumn({ cell: () => "1", header: "first", id: "dup" });
    registerVariantColumn({ cell: () => "2", header: "second", id: "dup" });

    const columns = getRegisteredVariantColumns();
    expect(columns).toHaveLength(1);
    expect(columns[0].header).toBe("second");
  });

  it("sorts by ascending priority", () => {
    registerVariantColumn(column("late", 100));
    registerVariantColumn(column("early", 1));
    registerVariantColumn(column("mid", 50));

    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["early", "mid", "late"]);
  });

  it("treats a missing priority as 0", () => {
    registerVariantColumn(column("explicit-negative", -5));
    registerVariantColumn(column("default-zero"));
    registerVariantColumn(column("explicit-positive", 5));

    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual([
      "explicit-negative",
      "default-zero",
      "explicit-positive",
    ]);
  });

  it("keeps registration order for equal priorities (stable sort)", () => {
    registerVariantColumn(column("first", 10));
    registerVariantColumn(column("second", 10));
    registerVariantColumn(column("third", 10));

    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["first", "second", "third"]);
  });

  it("returns a fresh array that does not mutate the registry", () => {
    registerVariantColumn(column("a"));
    const columns = getRegisteredVariantColumns();
    columns.push(column("injected"));
    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["a"]);
  });

  it("unregisters and clears", () => {
    registerVariantColumn(column("a"));
    registerVariantColumn(column("b"));

    expect(unregisterVariantColumn("a")).toBe(true);
    expect(unregisterVariantColumn("a")).toBe(false);
    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["b"]);

    clearVariantColumns();
    expect(getRegisteredVariantColumns()).toEqual([]);
  });

  it("validates the definition", () => {
    expect(() => registerVariantColumn({ cell: () => null, header: "x", id: "" })).toThrow(
      TypeError,
    );
    expect(() =>
      registerVariantColumn({
        id: "no-cell",
        header: "x",
        // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input under test
        cell: undefined as any,
      }),
    ).toThrow(TypeError);
  });

  it("keeps the deprecated product-named aliases writing to the same registry", () => {
    // An unmigrated contributor still calls `registerProductColumn`. It must
    // land in the one store the Catalog route reads, or its column silently
    // disappears - which is exactly the failure a rename could have caused.
    registerProductColumn(column("legacy.column"));
    expect(hasProductColumn("legacy.column")).toBe(true);
    expect(hasVariantColumn("legacy.column")).toBe(true);
    expect(getRegisteredVariantColumns().map((c) => c.id)).toEqual(["legacy.column"]);
    expect(getRegisteredProductColumns).toBe(getRegisteredVariantColumns);
    expect(registerProductColumn).toBe(registerVariantColumn);
  });

  it("shares one store across module copies via globalThis (dedupe proof)", () => {
    // Simulate a second, independently-bundled copy of this module: it anchors
    // on the same Symbol.for key, so a fresh `getStore()`-style read finds the
    // columns the first copy registered. This is why cross-plugin registration
    // converges on ONE registry even if the module is instantiated twice.
    registerVariantColumn(column("from-copy-1"));

    // Deliberately still v1: bumping the key when the cell context changed
    // shape would split the store between an unmigrated plugin and the route.
    const key = Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1");
    const store = (globalThis as Record<symbol, unknown>)[key] as {
      version: number;
      columns: Map<string, VariantColumnDef>;
    };

    expect(store).toBeDefined();
    expect(store.version).toBe(1);
    expect(store.columns.has("from-copy-1")).toBe(true);

    // A "second copy" writing straight to the shared store is visible through
    // the public API, and vice versa.
    store.columns.set("from-copy-2", column("from-copy-2"));
    expect(hasVariantColumn("from-copy-2")).toBe(true);
  });
});
