"use client";

import dynamic from "next/dynamic";
import { Shell } from "@/components/Shell";

const DashboardSection = dynamic(
  () => import("@/components/DashboardSection").then((module) => module.DashboardSection),
  { loading: () => null },
);
const TrackedTendersSection = dynamic(
  () => import("@/components/TrackedTendersSection").then((module) => module.TrackedTendersSection),
  { loading: () => null },
);
const AusschreibungenSection = dynamic(
  () => import("@/components/AusschreibungenSection").then((module) => module.AusschreibungenSection),
  { loading: () => null },
);
const UsTendersSection = dynamic(
  () => import("@/components/UsTendersSection").then((module) => module.UsTendersSection),
  { loading: () => null },
);
const McpSection = dynamic(
  () => import("@/components/McpSection").then((module) => module.McpSection),
  { loading: () => null },
);

export function InteractiveApp() {
  return (
    <Shell>
      {(currentView, setView, openAuth) => {
        switch (currentView) {
          case "discovery":
            return <DashboardSection openAuth={openAuth} />;
          case "trackedTenders":
            return <TrackedTendersSection />;
          case "publicTenders":
            return <AusschreibungenSection onNavigate={setView} />;
          case "usOpportunities":
            return <UsTendersSection />;
          case "mcp":
            return <McpSection />;
          default:
            return <DashboardSection openAuth={openAuth} />;
        }
      }}
    </Shell>
  );
}
