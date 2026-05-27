/**
 * Apple touch icon (180×180) — Next.js Metadata API convention.
 *
 * iOS Safari uses <link rel="apple-touch-icon"> separately from the
 * web manifest icons. When iOS users "Add to Home Screen", iOS pulls
 * THIS icon for the home-screen tile (NOT the manifest icons).
 *
 * File name `apple-icon.tsx` is a Next.js magic convention — auto-served
 * at /apple-icon.png and auto-linked from <head>. No manifest reference
 * needed.
 *
 * iOS doesn't apply a corner-radius mask — we ship pre-rounded artwork.
 */
import { ImageResponse } from "next/og";

export const size = {
  width:  180,
  height: 180,
};
export const contentType = "image/png";
// Skip static prerender — same @vercel/og Invalid URL issue as icon.tsx.
export const dynamic = "force-dynamic";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          "100%",
          height:         "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "linear-gradient(135deg, #C2410C 0%, #9A3412 100%)",
          color:          "#FFFFFF",
          fontSize:       120,
          fontWeight:     700,
          fontFamily:     "serif",
          letterSpacing:  "-0.04em",
          borderRadius:   30, // iOS rounds the corners itself but we pre-round for older OS
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
