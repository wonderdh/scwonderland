"use client";

import { useEffect } from "react";

export function ScrollToSection({ section }: { section: string | null }) {
  useEffect(() => {
    if (section === "add") {
      const el = document.getElementById("add");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section]);
  return null;
}
