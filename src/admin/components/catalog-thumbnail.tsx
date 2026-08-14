import { Photo } from "@medusajs/icons";
import { clx } from "@medusajs/ui";

/**
 * The admin's thumbnail cell: an image when there is one, and otherwise the
 * dashboard's own placeholder rather than a blank grey square.
 *
 * This is Medusa's `Thumbnail`, reproduced. The stock Products list renders
 * `@medusajs/dashboard`'s `src/components/common/thumbnail/thumbnail.tsx`,
 * which is the same box with the same `Photo` glyph inside it - but that file
 * is internal to the dashboard: `@medusajs/dashboard`'s `exports` map only
 * publishes `.`, `./components` (which is `ConfigurableDataTable` and
 * `LayoutComposer`), `./hooks`, `./lib` and `./css`, and `Thumbnail` is in
 * none of them. There is no supported import for it, and depending on the whole
 * dashboard package to reach one 20-line component would be worse than this.
 *
 * So the placeholder itself is not invented here: it is `Photo` from
 * `@medusajs/icons`, the exact icon the dashboard uses, in the exact wrapper
 * classes it uses, at the same two sizes. Keep this file in sync with that
 * source if it ever moves.
 */
export function CatalogThumbnail({
  alt,
  size = "base",
  src,
}: {
  src?: string | null;
  alt?: string;
  size?: "small" | "base";
}) {
  return (
    <div
      className={clx(
        "flex items-center justify-center overflow-hidden rounded border border-ui-border-base bg-ui-bg-component",
        {
          "h-5 w-4": size === "small",
          "h-8 w-6": size === "base",
        },
      )}
    >
      {src ? (
        // biome-ignore lint/nursery/noImgElement: the admin has no next/image; a plain img is what the dashboard uses too.
        <img alt={alt ?? ""} className="h-full w-full object-cover object-center" src={src} />
      ) : (
        <Photo className="text-ui-fg-subtle" />
      )}
    </div>
  );
}
