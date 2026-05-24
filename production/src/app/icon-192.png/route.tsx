/**
 * Dynamic 192×192 PNG icon for the PWA manifest.
 *
 * Generated at runtime via Next.js ImageResponse — no static asset to
 * ship, no design tool needed. The icon is a solid amber tile with a
 * white serif "R" centered, matching the in-app brand pill.
 *
 * Served at /icon-192.png. Referenced by app/manifest.ts.
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
          fontSize:       128,
          fontWeight:     700,
          fontFamily:     "serif",
          letterSpacing:  "-0.04em",
          borderRadius:   "20%", // looks rounded on Android, gets masked properly on iOS
        }}
      >
        R
      </div>
    ),
    {
      width:  192,
      height: 192,
    },
  );
}
