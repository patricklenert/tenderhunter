import type { Metadata } from "next";
import { UpgradePage } from "@/components/billing/UpgradePage";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Tenderhunter Pro",
  description: "Prüfen Sie in wenigen Minuten, ob sich eine Ausschreibung für Ihr Unternehmen lohnt.",
  robots: { index: false, follow: false },
};

export default function UpgradeRoute() {
  return <UpgradePage />;
}
