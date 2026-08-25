"use client";

import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Abre a página correspondente e dispara a impressão (PDF pelo navegador).
export function PrintButton({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        router.push(href);
        setTimeout(() => window.print(), 800);
      }}
    >
      <Printer className="h-3.5 w-3.5" /> PDF
    </Button>
  );
}
