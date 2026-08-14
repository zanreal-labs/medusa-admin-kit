import { Text } from "@medusajs/ui";
import { useEffect, useMemo, useState } from "react";
import { buildVariantColumnContext } from "../../registry/context";
import type {
  CatalogProduct,
  CatalogVariantRow,
  VariantColumnAsyncState,
  VariantColumnDef,
} from "../../registry/types";

const SYNC_ASYNC_STATE: undefined = undefined;

/**
 * Renders one registered column's cell for one variant row.
 *
 * This owns the two things a bare `def.cell(ctx)` call cannot, so a
 * contributor never has to hand-roll them:
 *
 * - **Async data.** When `def.loadData` is set, it fires once this component
 *   mounts (after the table has already rendered the row) and never blocks
 *   the base table's own render or `isLoading` state. `cell` is called again
 *   on every state transition: `{ isLoading: true }` first, then either
 *   `{ data }` or `{ error }` once the fetch settles.
 * - **Fault isolation.** A contributed `cell` that throws - synchronously, or
 *   because `loadData` rejected and the cell does not handle `async.error` -
 *   degrades to an inline error state for that one cell. It does not take
 *   down the row, the table, or any other plugin's column. A plugin that is
 *   not installed simply never registers a column at all, so this component
 *   never runs for it - there is nothing to degrade.
 */
export function RegisteredVariantCell<TProduct extends CatalogProduct, TData = unknown>({
  def,
  row,
}: {
  def: VariantColumnDef<TProduct, TData>;
  row: CatalogVariantRow<TProduct>;
}) {
  const ctx = useMemo(() => buildVariantColumnContext(row), [row]);
  const [asyncState, setAsyncState] = useState<VariantColumnAsyncState<TData>>(() => ({
    data: undefined,
    error: null,
    isLoading: Boolean(def.loadData),
  }));

  useEffect(() => {
    const { loadData } = def;
    if (!loadData) {
      return;
    }

    let cancelled = false;
    setAsyncState({ data: undefined, error: null, isLoading: true });

    loadData(ctx)
      .then((data) => {
        if (!cancelled) {
          setAsyncState({ data, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAsyncState({ data: undefined, error, isLoading: false });
        }
      });

    return () => {
      cancelled = true;
    };
    // `def` is registered once at boot and its identity is stable; `ctx` is
    // rebuilt whenever the row changes (a new page/search fetch).
  }, [def, ctx]);

  try {
    return def.cell(ctx, def.loadData ? asyncState : SYNC_ASYNC_STATE);
  } catch {
    return (
      <Text className="text-ui-fg-error" size="small">
        Error
      </Text>
    );
  }
}
