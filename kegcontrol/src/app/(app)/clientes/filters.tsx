"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from "@/lib/enums";

export function CustomerFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="no-print mb-4 flex flex-wrap gap-2">
      <Input
        placeholder="Buscar por nome, empresa, documento, cidade…"
        defaultValue={sp.get("q") ?? ""}
        onChange={(e) => setParam("q", e.target.value)}
        className="max-w-sm"
      />
      <Select
        defaultValue={sp.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="w-44"
      >
        <option value="">Todos os status</option>
        {CUSTOMER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CUSTOMER_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
