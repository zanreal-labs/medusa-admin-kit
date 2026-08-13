import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProductColumns,
  getProductColumn,
  getRegisteredProductColumns,
  hasProductColumn,
  registerProductColumn,
  unregisterProductColumn,
} from "../product-columns";
import type { ProductColumnDef } from "../types";

const column = (id: string, priority?: number): ProductColumnDef => ({
  cell: () => id,
  header: id,
  id,
  priority,
});

describe("product column registry", () => {
  beforeEach(() => {
    clearProductColumns();
  });

  it("registers and returns a column", () => {
    registerProductColumn(column("a"));
    expect(hasProductColumn("a")).toBe(true);
    expect(getProductColumn("a")?.id).toBe("a");
    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual(["a"]);
  });

  it("dedupes by id - last registration wins", () => {
    registerProductColumn({ cell: () => "1", header: "first", id: "dup" });
    registerProductColumn({ cell: () => "2", header: "second", id: "dup" });

    const columns = getRegisteredProductColumns();
    expect(columns).toHaveLength(1);
    expect(columns[0].header).toBe("second");
  });

  it("sorts by ascending priority", () => {
    registerProductColumn(column("late", 100));
    registerProductColumn(column("early", 1));
    registerProductColumn(column("mid", 50));

    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual(["early", "mid", "late"]);
  });

  it("treats a missing priority as 0", () => {
    registerProductColumn(column("explicit-negative", -5));
    registerProductColumn(column("default-zero"));
    registerProductColumn(column("explicit-positive", 5));

    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual([
      "explicit-negative",
      "default-zero",
      "explicit-positive",
    ]);
  });

  it("keeps registration order for equal priorities (stable sort)", () => {
    registerProductColumn(column("first", 10));
    registerProductColumn(column("second", 10));
    registerProductColumn(column("third", 10));

    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual(["first", "second", "third"]);
  });

  it("returns a fresh array that does not mutate the registry", () => {
    registerProductColumn(column("a"));
    const columns = getRegisteredProductColumns();
    columns.push(column("injected"));
    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual(["a"]);
  });

  it("unregisters and clears", () => {
    registerProductColumn(column("a"));
    registerProductColumn(column("b"));

    expect(unregisterProductColumn("a")).toBe(true);
    expect(unregisterProductColumn("a")).toBe(false);
    expect(getRegisteredProductColumns().map((c) => c.id)).toEqual(["b"]);

    clearProductColumns();
    expect(getRegisteredProductColumns()).toEqual([]);
  });

  it("validates the definition", () => {
    expect(() => registerProductColumn({ cell: () => null, header: "x", id: "" })).toThrow(
      TypeError,
    );
    expect(() =>
      registerProductColumn({
        id: "no-cell",
        header: "x",
        // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input under test
        cell: undefined as any,
      }),
    ).toThrow(TypeError);
  });

  it("shares one store across module copies via globalThis (dedupe proof)", () => {
    // Simulate a second, independently-bundled copy of this module: it anchors
    // on the same Symbol.for key, so a fresh `getStore()`-style read finds the
    // columns the first copy registered. This is why cross-plugin registration
    // converges on ONE registry even if the module is instantiated twice.
    registerProductColumn(column("from-copy-1"));

    const key = Symbol.for("@zanreal/medusa-admin-kit/product-column-registry/v1");
    const store = (globalThis as Record<symbol, unknown>)[key] as {
      version: number;
      columns: Map<string, ProductColumnDef>;
    };

    expect(store).toBeDefined();
    expect(store.version).toBe(1);
    expect(store.columns.has("from-copy-1")).toBe(true);

    // A "second copy" writing straight to the shared store is visible through
    // the public API, and vice versa.
    store.columns.set("from-copy-2", column("from-copy-2"));
    expect(hasProductColumn("from-copy-2")).toBe(true);
  });
});
