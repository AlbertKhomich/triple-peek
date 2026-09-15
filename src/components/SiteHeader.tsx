"use client";

import { useEffect, useState } from "react";

export default function SiteHeader() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("triple-peek-theme"); } catch {}
    const initial = saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const frame = requestAnimationFrame(() => {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(initial);
      setTheme(initial);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    setTheme(next);
    try { localStorage.setItem("triple-peek-theme", next); } catch {}
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <header className="site-header">
      <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={toggleTheme}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {theme === "dark" ? (
            <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42M6.35 17.65l-1.42 1.42" /></>
          ) : <path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z" />}
        </svg>
      </button>
    </header>
  );
}
