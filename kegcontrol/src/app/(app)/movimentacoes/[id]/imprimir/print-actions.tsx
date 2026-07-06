"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintActions() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Imprimir folha
    </Button>
  );
}
