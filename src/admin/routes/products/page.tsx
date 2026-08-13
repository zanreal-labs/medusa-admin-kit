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
import { useEffect, useMemo, useState } from "react";
import { renderRegisteredCell, resolveProductColumns } from "../../../registry/columns";
import type { BaseProductColumnId } from "../../../registry/columns";
import { buildProductColumnContext } from "../../../registry/context";
import { getRegisteredProductColumns } from "../../../registry/product-columns";
import {
  buildProductListQuery,
  DEFAULT_PAGE_SIZE,
  mapProductListResponse,
} from "../../../registry/query";
import type { ProductColumnDef } from "../../../registry/types";
import { sdk } from "../../lib/sdk";

type AdminProduct = HttpTypes.AdminProduct;

const columnHelper = createDataTableColumnHelper<AdminProduct>();

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
function buildBaseColumn(id: BaseProductColumnId): DataTableColumnDef<AdminProduct, unknown> {
  switch (id) {
    case "thumbnail": {
      return columnHelper.display({
        cell: ({ row }) => {
          const { thumbnail } = row.original;
          return thumbnail ? (
            // biome-ignore lint/nursery/noImgElement: the admin has no next/image; a plain img is correct here.
            <img alt="" className="h-8 w-8 rounded object-cover" src={thumbnail} />
          ) : (
            <div className="h-8 w-8 rounded bg-ui-bg-component" />
          );
        },
        header: "",
        id: "thumbnail",
      });
    }
    case "title": {
      return columnHelper.display({
        cell: ({ row }) => (
          <span className="txt-compact-small-plus text-ui-fg-base">
            {row.original.title ?? "-"}
          </span>
        ),
        header: "Title",
        id: "title",
      });
    }
    case "handle": {
      return columnHelper.display({
        cell: ({ row }) => {
          const { handle } = row.original;
          return (
            <Text className="text-ui-fg-subtle" size="small">
              {handle ? `/${handle}` : "-"}
            </Text>
          );
        },
        header: "Handle",
        id: "handle",
      });
    }
    case "status": {
      return columnHelper.display({
        cell: ({ row }) => {
          const { status } = row.original;
          return <StatusBadge color={statusColor(status)}>{status ?? "unknown"}</StatusBadge>;
        },
        header: "Status",
        id: "status",
      });
    }
    case "sku_summary": {
      return columnHelper.display({
        cell: ({ row }) => {
          const ctx = buildProductColumnContext(row.original);
          const label = `${ctx.variantCount} ${ctx.variantCount === 1 ? "variant" : "variants"}`;
          return <Text size="small">{ctx.firstSku ? `${label} - ${ctx.firstSku}` : label}</Text>;
        },
        header: "SKUs",
        id: "sku_summary",
      });
    }
    default: {
      return columnHelper.display({ cell: () => null, header: "", id });
    }
  }
}

/** Wrap a contributed column definition as a `@medusajs/ui` display column. */
function buildRegisteredColumn(
  def: ProductColumnDef<AdminProduct>,
): DataTableColumnDef<AdminProduct, unknown> {
  return columnHelper.display({
    cell: ({ row }) => renderRegisteredCell(def, row.original),
    header: def.header,
    id: def.id,
  });
}

function useProductColumns(): DataTableColumnDef<AdminProduct, unknown>[] {
  // Registration happens at admin boot (contributor widgets run before any
  // navigation), so by the time this route mounts the registry is fully
  // populated. Computing once per mount is enough; a real change to the set of
  // installed plugins is a full admin reload.
  return useMemo(() => {
    const registered = getRegisteredProductColumns() as ProductColumnDef<AdminProduct>[];
    return resolveProductColumns<AdminProduct>(registered).map((entry) =>
      entry.source === "base" ? buildBaseColumn(entry.id) : buildRegisteredColumn(entry.def),
    );
  }, []);
}

const ProductsPage = () => {
  const columns = useProductColumns();
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ products: AdminProduct[]; count: number }>({
    count: 0,
    products: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const query = buildProductListQuery({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
    });
    sdk.admin.product
      .list(query)
      .then((response) => {
        if (!cancelled) {
          setResult(mapProductListResponse<AdminProduct>(response));
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ count: 0, products: [] });
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, pagination.pageSize, search]);

  const instance = useDataTable({
    columns,
    data: result.products,
    getRowId: (product) => product.id,
    isLoading,
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
            <Heading level="h2">Products</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              Extensible products list. Columns contributed by installed plugins render alongside
              the base columns.
            </Text>
          </div>
          <DataTable.Search placeholder="Search products" />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  );
};

export const config = defineRouteConfig({
  icon: Tag,
  label: "Products",
});

export default ProductsPage;
