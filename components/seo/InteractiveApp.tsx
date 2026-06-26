"use client";

import { Shell } from "@/components/Shell";
import { DashboardSection } from "@/components/DashboardSection";
import { TrackedTendersSection } from "@/components/TrackedTendersSection";
import { AusschreibungenSection } from "@/components/AusschreibungenSection";

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
          default:
            return <DashboardSection openAuth={openAuth} />;
        }
      }}
    </Shell>
  );
}
