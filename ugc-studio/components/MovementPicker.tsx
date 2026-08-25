"use client";

import { MOVEMENTS } from "@/prompts/movements";

interface MovementPickerProps {
  value: string;
  onChange: (movementId: string) => void;
  disabled?: boolean;
}

/** Biblioteca de movimentos — chips selecionáveis usados no prompt do vídeo. */
export function MovementPicker({ value, onChange, disabled }: MovementPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOVEMENTS.map((movement) => {
        const selected = movement.id === value;
        return (
          <button
            key={movement.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(movement.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition
              ${
                selected
                  ? "border-brand bg-brand/20 text-ink"
                  : "border-line bg-panel-2 text-ink-dim hover:border-brand/50 hover:text-ink"
              }
              ${disabled ? "opacity-50" : ""}`}
          >
            {movement.emoji} {movement.label}
          </button>
        );
      })}
    </div>
  );
}
