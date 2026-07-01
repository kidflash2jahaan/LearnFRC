"use client";

import * as React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { CommandPalette } from "@/components/search/command-palette";

function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          borderRadius: "0.9rem",
          fontFamily: "var(--font-inter)",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
    >
      {children}
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  );
}
