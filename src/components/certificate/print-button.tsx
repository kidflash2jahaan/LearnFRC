"use client";

import { Button } from "@/components/ui/button";

/**
 * Send the current page to the printer.
 *
 * The one client boundary on two otherwise server-rendered pages, and the only
 * reason either of them ships JavaScript: `window.print()` has no server
 * equivalent. It hides itself in print, because a button photographed onto
 * paper is a button nobody can press.
 *
 * The label names what happens, including the outcome most people actually
 * want. "Print" alone reads as "waste paper" to someone who only wants a PDF.
 */
export function PrintButton() {
  return (
    <Button variant="brand" onClick={() => window.print()} className="print:hidden">
      Print, or save as PDF
    </Button>
  );
}
