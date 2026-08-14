import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Tag } from "@medusajs/icons";
import type { HttpTypes } from "@medusajs/types";
import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  StatusBadge,
  Text,
  useDataTable,
} from "@medusajs/ui";
import type { DataTableColumnDef, DataTablePaginationState } from "@medusajs/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { resolveCatalogColumns } from "../../../registry/columns";
import type { BaseCatalogColumnId } from "../../../registry/columns";
import { readVariantSrp, selectVariantPrice } from "../../../registry/money";
import {
  buildVariantListQuery,
  DEFAULT_PAGE_SIZE,
  mapVariantListResponse,
} from "../../../registry/query";
import { unwrapClickedRow, variantDetailHref } from "../../../registry/row-link";
import type { VariantColumnDef } from "../../../registry/types";
import { getRegisteredVariantColumns } from "../../../registry/variant-columns";
import { CatalogThumbnail } from "../../components/catalog-thumbnail";
import { MoneyCell } from "../../components/money-cell";
import { RegisteredVariantCell } from "../../components/registered-variant-cell";
import { sdk } from "../../lib/sdk";

type AdminProduct = HttpTypes.AdminProduct;
type VariantRow = HttpTypes.AdminProductVariant;

const columnHelper = createDataTableColumnHelper<VariantRow>();

/** Map a product status to a `StatusBadge` colour. */
function statusColor(status?: string | null): "green" | "orange" | "red" | "grey" {
  switch (status) {
    case "published": {
      return "green";
    }
    case "proposed": {
      return "orange";
    }
    case "rejected": {
      return "red";
    }
    default: {
      return "grey";
    }
  }
}

/** Build one of the kit's base columns by id. */
function buildBaseColumn(id: BaseCatalogColumnId): DataTableColumnDef<VariantRow, unknown> {
  switch (id) {
    case "thumbnail": {
      return columnHelper.display({
        cell: ({ row }) => (
          // A variant may carry its own image; otherwise the product's is the
          // right thing to show, and when there is neither `CatalogThumbnail`
          // renders the admin's own placeholder rather than an empty square.
          <CatalogThumbnail
            alt={row.original.title ?? ""}
            src={row.original.thumbnail ?? row.original.product?.thumbnail}
          />
        ),
        header: "",
        id: "thumbnail",
      });
    }
    case "product": {
      return columnHelper.display({
        cell: ({ row }) => (
          <span className="txt-compact-small-plus text-ui-fg-base">
            {row.original.product?.title ?? "-"}
          </span>
        ),
        header: "Product",
        id: "product",
      });
    }
    case "variant": {
      return columnHelper.display({
        cell: ({ row }) => (
          <Text className="text-ui-fg-subtle" size="small">
            {row.original.title ?? "-"}
          </Text>
        ),
        header: "Variant",
        id: "variant",
      });
    }
    case "sku": {
      return columnHelper.display({
        cell: ({ row }) => {
          const { sku } = row.original;
          return sku ? (
            <Text size="small">{sku}</Text>
          ) : (
            <Text className="text-ui-fg-muted" size="small">
              no sku
            </Text>
          );
        },
        header: "SKU",
        id: "sku",
      });
    }
    case "status": {
      return columnHelper.display({
        cell: ({ row }) => {
          const status = row.original.product?.status;
          return <StatusBadge color={statusColor(status)}>{status ?? "unknown"}</StatusBadge>;
        },
        header: "Status",
        id: "status",
      });
    }
    case "price": {
      // `accessor` rather than `display` because the column helper only offers
      // the `align` sugar on accessor columns, and a right-aligned header over
      // right-aligned figures is what makes a money column scannable. The
      // accessor value is the amount itself (typed `unknown` so the column
      // stays assignable alongside the display columns), which is the honest
      // value for this column to carry. Sorting stays off - the helper's
      // default - because the API paginates server-side and sorting one page
      // client-side would order the page, not the catalogue.
      return columnHelper.accessor((row): unknown => selectVariantPrice(row.prices)?.price.amount, {
        align: "right",
        cell: ({ row }) => {
          const selected = selectVariantPrice(row.original.prices);
          return (
            <MoneyCell
              money={selected?.price ?? null}
              otherCount={selected?.otherCount ?? 0}
              title={
                selected
                  ? undefined
                  : "This variant has no price set. That is normal for a variant that is not offered for sale."
              }
            />
          );
        },
        header: "Shop",
        id: "price",
      });
    }
    case "srp": {
      return columnHelper.accessor((row): unknown => readVariantSrp(row), {
        align: "right",
        cell: ({ row }) => {
          const srp = readVariantSrp(row.original);
          // `metadata.srp` is a bare amount: the store types a number, and
          // nothing records what currency it is in. Rendering it under the shop
          // price's currency would be inventing a fact, so the cell shows the
          // number with no currency and says why on hover, rather than
          // labelling it with a currency the data does not claim.
          return (
            <MoneyCell
              money={srp === null ? null : { amount: srp, currency: null }}
              title={
                srp === null
                  ? "No `srp` in this variant's or its product's metadata."
                  : "SRP from metadata. It is stored as a bare amount, with no currency of its own."
              }
            />
          );
        },
        header: "SRP",
        id: "srp",
      });
    }
    default: {
      return columnHelper.display({ cell: () => null, header: "", id });
    }
  }
}

/** Wrap a contributed column definition as a `@medusajs/ui` display column. */
function buildRegisteredColumn(
  def: VariantColumnDef<AdminProduct>,
): DataTableColumnDef<VariantRow, unknown> {
  return columnHelper.display({
    cell: ({ row }) => <RegisteredVariantCell def={def} row={row.original} />,
    header: def.header,
    id: def.id,
  });
}

function useCatalogColumns(): DataTableColumnDef<VariantRow, unknown>[] {
  // Registration happens at admin boot (contributor widgets run before any
  // navigation), so by the time this route mounts the registry is fully
  // populated. Computing once per mount is enough; a real change to the set of
  // installed plugins is a full admin reload.
  return useMemo(() => {
    const registered = getRegisteredVariantColumns() as VariantColumnDef<AdminProduct>[];
    return resolveCatalogColumns<AdminProduct>(registered).map((entry) =>
      entry.source === "base" ? buildBaseColumn(entry.id) : buildRegisteredColumn(entry.def),
    );
  }, []);
}

const CatalogPage = () => {
  const columns = useCatalogColumns();
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ variants: VariantRow[]; count: number }>({
    count: 0,
    variants: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const query = buildVariantListQuery({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
    });
    sdk.admin.productVariant
      .list(query)
      .then((response) => {
        if (!cancelled) {
          setResult(mapVariantListResponse<VariantRow>(response));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ count: 0, variants: [] });
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, pagination.pageSize, search]);

  const onRowClick = useCallback(
    (event: ReactMouseEvent<HTMLTableRowElement, MouseEvent>, clicked: VariantRow) => {
      const href = variantDetailHref(unwrapClickedRow(clicked));
      if (!href) {
        return;
      }
      // Match the dashboard's own row behaviour: modifier-clicks open a new
      // tab instead of navigating this one.
      if (event.metaKey || event.ctrlKey || event.button === 1) {
        window.open(href, "_blank", "noreferrer");
        return;
      }
      navigate(href);
    },
    [navigate],
  );

  const instance = useDataTable({
    columns,
    data: result.variants,
    getRowId: (variant) => variant.id,
    isLoading,
    onRowClick,
    pagination: { onPaginationChange: setPagination, state: pagination },
    rowCount: result.count,
    search: {
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
      state: search,
    },
  });

  return (
    <Container className="divide-y p-0">
      <DataTable instance={instance}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-y-3 px-6 py-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-y-1">
            <Heading level="h2">Catalog</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              One row per variant, separate from the stock Products page. Columns contributed by
              installed plugins render alongside the base columns. Click a row to open that
              variant.
            </Text>
          </div>
          <DataTable.Search placeholder="Search variants" />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  );
};

// A dedicated nav route, deliberately not "/app/products" - the stock admin
// already owns that path for core product CRUD. This route mounts at
// "/app/catalog" (the folder name below is the route path) with its own
// sidebar entry, so it cannot replace or shadow the stock Products page.
export const config = defineRouteConfig({
  icon: Tag,
  label: "Catalog",
});

export default CatalogPage;
