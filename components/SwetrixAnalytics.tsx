"use client";

import { useEffect } from "react";
import * as Swetrix from "swetrix";

export function SwetrixAnalytics() {
  useEffect(() => {
    Swetrix.init("tkzHcKk321F1", {
      apiURL: "https://swetrix.pagestats.win/backend/v1/log",
    });
    Swetrix.trackViews();
  }, []);

  return null;
}
