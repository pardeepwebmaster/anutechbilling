/**
 * Dynamic 512×512 PNG icon for the PWA manifest (larger size).
 * Same design as icon-192 but rendered at higher resolution. Used by
 * Android adaptive icons + Windows tiles + PWA install prompts.
 *
 * Served at /icon-512.png. Referenced by app/manifest.ts.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-static";

export async function GET() {
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
          fontSize:       340,
          fontWeight:     700,
          fontFamily:     "serif",
          letterSpacing:  "-0.04em",
          borderRadius:   "20%",
        }}
      >
        R
      </div>
    ),
    {
      width:  512,
      height: 512,
    },
  );
}
