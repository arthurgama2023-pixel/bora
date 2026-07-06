"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS } from "@/lib/enums";

export function MovementFilters() {
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
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <Select
        defaultValue={sp.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
        className="w-44"
      >
        <option value="">Todos os tipos</option>
        {MOVEMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {MOVEMENT_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        defaultValue={sp.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
        className="w-40"
        title="De"
      />
      <span className="text-sm text-muted-foreground">até</span>
      <Input
        type="date"
        defaultValue={sp.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
        className="w-40"
        title="Até"
      />
    </div>
  );
}
