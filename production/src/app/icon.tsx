/**
 * Favicon (32×32) — Next.js Metadata API convention.
 *
 * Used in browser tabs, bookmarks, search results. Tiny size so the
 * "R" needs to be bold and readable at small zoom levels.
 *
 * Auto-served at /icon.png and auto-injected into <head>.
 */
import { ImageResponse } from "next/og";

export const size = {
  width:  32,
  height: 32,
};
export const contentType = "image/png";
// Skip static prerender — @vercel/og module hits Invalid URL during static
// export. Runtime generation works fine + the file is cached at the edge.
export const dynamic = "force-dynamic";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          "100%",
          height:         "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "#C2410C",
          color:          "#FFFFFF",
          fontSize:       22,
          fontWeight:     700,
          fontFamily:     "serif",
          borderRadius:   6,
        }}
      >
        R
      </div>
    ),
    {
      ...size,
    },
  );
}
