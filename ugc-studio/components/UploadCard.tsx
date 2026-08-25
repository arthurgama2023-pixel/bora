"use client";

import { useId, useRef, useState } from "react";
import { fileToDataUrl } from "@/utils/clientImage";

interface UploadCardProps {
  title: string;
  hint: string;
  value: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}

/** Cartão de upload com preview, clique e arrastar-e-soltar. */
export function UploadCard({ title, hint, value, onChange, disabled }: UploadCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    onChange(await fileToDataUrl(file));
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) void handleFile(e.dataTransfer.files[0]);
      }}
      className={`block cursor-pointer rounded-2xl border-2 border-dashed p-3 transition
        ${dragging ? "border-brand bg-brand/10" : "border-line bg-panel hover:border-brand/60"}
        ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-panel-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-ink-dim">
              +
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-ink-dim">
            {value ? "Imagem carregada — clique para trocar" : hint}
          </p>
        </div>
      </div>
    </label>
  );
}
