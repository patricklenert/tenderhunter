import type { Metadata } from "next";
import { UpgradePage } from "@/components/billing/UpgradePage";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Billing-Pläne",
  description: "Wähle den passenden Tenderhunter Billing-Plan.",
  robots: { index: false, follow: false },
};

export default function UpgradeRoute() {
  return <UpgradePage />;
}
