import { ImageResponse } from "next/og";

import { siteBrand } from "@/lib/site-identity";

export const alt = "Cite Supply — Publisher-ready data, charts, and tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f7f5f0",
        color: "#11141a",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          border: "2px solid #d8d5ce",
          borderRadius: "32px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", fontSize: "34px", fontWeight: 700 }}>
          <div
            style={{
              alignItems: "center",
              background: "#11141a",
              borderRadius: "12px",
              color: "#fff",
              display: "flex",
              height: "64px",
              justifyContent: "center",
              marginRight: "24px",
              width: "64px",
            }}
          >
            {siteBrand.mark}
          </div>
          {siteBrand.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{ color: "#2870ed", fontSize: "24px", fontWeight: 700, letterSpacing: "4px" }}
          >
            WHERE PUBLISHERS FIND DATA
          </div>
          <div style={{ fontSize: "66px", fontWeight: 700, lineHeight: 1.05, marginTop: "20px" }}>
            Publisher-ready data, charts, and tools.
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
