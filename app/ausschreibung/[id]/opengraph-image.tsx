import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { tenders } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { CATEGORY_LABELS } from "@/lib/categories";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ausschreibung auf Tenderhunter";

export default async function TenderOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenderId = parseInt(id, 10);

  let title = "Öffentliche Ausschreibung";
  let category = "";
  let deadline = "";
  let client = "";

  try {
    const rows = await db
      .select({
        title: tenders.title,
        category: tenders.category,
        deadlineAt: tenders.deadlineAt,
        metadataJson: tenders.metadataJson,
      })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), inArray(tenders.qualityStatus, ["qualified", "candidate"])))
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0];
      title = row.title ?? title;
      category = CATEGORY_LABELS[row.category ?? ""] ?? row.category ?? "";
      if (row.deadlineAt) {
        deadline = new Date(row.deadlineAt).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      }
      const meta =
        typeof row.metadataJson === "object" && row.metadataJson !== null
          ? (row.metadataJson as Record<string, unknown>)
          : {};
      if (typeof meta.client === "string") {
        client = meta.client.slice(0, 80);
      }
    }
  } catch {
    // DB unavailable, use defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#e9644d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                color: "#fff",
                fontWeight: 800,
              }}
            >
              T
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a2e" }}>
              Tenderhunter
            </div>
          </div>
          {category && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fef0ed",
                color: "#e9644d",
                padding: "8px 20px",
                borderRadius: 20,
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {category}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: title.length > 80 ? 40 : title.length > 50 ? 48 : 56,
              fontWeight: 800,
              color: "#1a1a2e",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40, fontSize: 24 }}>
          {client && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ color: "#999", fontSize: 18 }}>Auftraggeber</div>
              <div style={{ color: "#1a1a2e", fontWeight: 600 }}>{client}</div>
            </div>
          )}
          {deadline && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ color: "#999", fontSize: 18 }}>Frist</div>
              <div style={{ color: "#e9644d", fontWeight: 700 }}>{deadline}</div>
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
