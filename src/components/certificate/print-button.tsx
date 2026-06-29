"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      variant="brand"
      onClick={() => window.print()}
      className="font-mono print:hidden"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </Button>
  );
}
