"use client";

// Análise de criativos: upload de imagem/vídeo → nota 0-100 + sugestões.
import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileVideo, Lightbulb, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/lib/markdown";
import type { CreativeAnalysis } from "@/services/ai/creative";
import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function barColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-destructive";
}

export function AnalyzerView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const analyze = useMutation({
    mutationFn: async (selected: File): Promise<CreativeAnalysis> => {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch("/api/creatives/analyze", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.analysis;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro na análise"),
  });

  const handleFile = useCallback(
    (selected: File | undefined) => {
      if (!selected) return;
      if (!selected.type.startsWith("image/") && !selected.type.startsWith("video/")) {
        toast.error("Envie uma imagem ou vídeo");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      analyze.mutate(selected);
    },
    [analyze],
  );

  const analysis = analyze.data;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Análise de criativos</h1>
          <p className="text-sm text-muted-foreground">
            Envie uma imagem ou vídeo e receba nota de 0 a 100 em hook, headline, CTA,
            legibilidade, oferta, qualidade, contraste, branding e políticas Meta.
          </p>
        </div>

        {/* Área de upload */}
        {!file && (
          <button
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">
              Arraste um criativo ou clique para escolher
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, WEBP, MP4 ou MOV · máx. 25 MB
            </p>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {file && (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            {/* Preview */}
            <Card className="h-fit">
              <CardContent className="p-3">
                {file.type.startsWith("image/") && previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Criativo enviado"
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-muted">
                    <FileVideo className="size-8 text-muted-foreground" />
                    <p className="mt-2 px-2 text-center text-xs text-muted-foreground break-all">
                      {file.name}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    analyze.reset();
                  }}
                >
                  <RotateCcw /> Analisar outro
                </Button>
              </CardContent>
            </Card>

            {/* Resultado */}
            <div className="space-y-4">
              {analyze.isPending ? (
                <>
                  <Skeleton className="h-28" />
                  <Skeleton className="h-64" />
                </>
              ) : analysis ? (
                <>
                  <Card className="animate-fade-in-up">
                    <CardContent className="flex items-center gap-5 p-5">
                      <div className="relative flex size-20 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="var(--muted)"
                            strokeWidth="3.5"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            className={scoreColor(analysis.overall)}
                            strokeDasharray={`${analysis.overall} 100`}
                          />
                        </svg>
                        <span
                          className={cn(
                            "absolute text-xl font-bold tabular-nums",
                            scoreColor(analysis.overall),
                          )}
                        >
                          {analysis.overall}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{analysis.verdict}</p>
                        <p className="text-xs text-muted-foreground">
                          Nota geral do criativo (0–100)
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="animate-fade-in-up">
                    <CardHeader>
                      <CardTitle>Avaliação por critério</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analysis.categories.map((category) => (
                        <div key={category.name}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{category.name}</span>
                            <span className={cn("tabular-nums text-xs font-semibold", scoreColor(category.score))}>
                              {category.score}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full transition-all", barColor(category.score))}
                              style={{ width: `${category.score}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{category.comment}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="animate-fade-in-up">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="size-4 text-warning" /> Sugestões de melhoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.suggestions.map((suggestion, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          <Markdown content={suggestion} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
