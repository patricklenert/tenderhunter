import type { Metadata } from "next";
import { UpgradePage } from "@/components/billing/UpgradePage";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Tenderhunter Pro",
  description: "Prüfen Sie Passung, Muss-Kriterien und Risiken, bevor Ihr Team Zeit in eine ungeeignete Ausschreibung investiert.",
  robots: { index: false, follow: false },
};

export default function UpgradeRoute() {
  return <UpgradePage />;
}
