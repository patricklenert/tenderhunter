"use client";

import { Menu } from "lucide-react";
import type { ViewKey } from "@/components/Shell";
import { NAV_ITEMS } from "@/components/Shell";

interface TopbarProps {
  currentView: ViewKey;
  onMenuClick: () => void;
}

export function Topbar({ currentView, onMenuClick }: TopbarProps) {
  const current = NAV_ITEMS.find((item) => item.key === currentView);

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface/80 backdrop-blur-md border-b border-border flex items-center px-4 lg:px-6 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-base font-semibold text-foreground">
        {current?.label ?? "Tenderhunter"}
      </h1>
    </header>
  );
}
