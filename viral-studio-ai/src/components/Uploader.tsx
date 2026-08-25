"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Upload com PROGRESSO real via XHR (o fetch não expõe progresso de upload).
// Vídeos de celular são grandes — sem % o usuário acha que travou.
function uploadFile(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ token: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/upload?name=${encodeURIComponent(file.name)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Resposta inválida do servidor."));
        }
      } else {
        let msg = `Falha no upload (${xhr.status}).`;
        try {
          msg = JSON.parse(xhr.responseText).error || msg;
        } catch {
          /* mantém msg padrão */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Erro de conexão durante o upload."));
    xhr.ontimeout = () => reject(new Error("O upload demorou demais."));
    xhr.send(file);
  });
}

export default function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [pct, setPct] = useState(0); // -1 = indeterminado (etapa sem % mensurável)
  const [captions, setCaptions] = useState(true);
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setPct(0);
    try {
      // 1) Upload de cada arquivo com progresso real (suporta vídeos longos)
      const uploads: { token: string; filename: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const prefix = files.length > 1 ? `Vídeo ${i + 1}/${files.length} · ` : "";
        setProgress(`${prefix}Enviando…`);
        const json = await uploadFile(f, (p) => {
          setPct(p * 100);
          setProgress(`${prefix}Enviando ${Math.round(p * 100)}%`);
        });
        uploads.push({ token: json.token, filename: json.filename });
      }
      // 2) Cria o projeto referenciando os uploads + direção criativa
      setPct(-1);
      setProgress("Iniciando o Diretor Criativo…");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploads, captions, goal: brief.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao criar o projeto.");
      router.push(`/p/${json.project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setProgress("");
      // libera o input para o usuário tentar de novo com o mesmo arquivo
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* <label> nativo: tocar em qualquer ponto abre o seletor do dispositivo
          (no celular, oferece Galeria / Arquivos / Câmera). Mais confiável que
          um .click() programático — funciona em todo mobile, inclusive iOS. */}
      <label
        className={`dropzone ${drag ? "drag" : ""} ${busy ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const fs = Array.from(e.dataTransfer.files ?? []);
          if (fs.length && !busy) void send(fs);
        }}
      >
        {busy ? (
          <>
            <div className="icon">
              <span className="spin" />
            </div>
            <strong>{progress || "Enviando…"}</strong>
            <div className="dz-progress">
              <div style={pct >= 0 ? { width: `${pct}%` } : undefined} className={pct < 0 ? "indet" : ""} />
            </div>
            <span>não feche esta tela — o processamento começa automaticamente</span>
          </>
        ) : (
          <>
            <div className="icon">🎬</div>
            <strong>Toque para escolher da galeria</strong>
            <span>
              ou arraste aqui · a IA soma o contexto de todos e monta UM corte final · até 10 vídeos
            </span>
            <span className="dz-btn">📁 Escolher vídeo(s)</span>
          </>
        )}
        <input
          ref={inputRef}
          className="dz-input"
          type="file"
          accept="video/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            // NÃO limpar e.target.value aqui: no iOS Safari isso invalida o File
            // antes do upload ler os bytes (sobe vazio). O reset acontece só em
            // caso de erro, dentro de send().
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) void send(fs);
          }}
        />
      </label>

      {!busy && (
        <>
          <div className="brief-box">
            <label htmlFor="brief">
              <strong>🎯 Direção criativa</strong> <em>(opcional — o Diretor segue à risca)</em>
            </label>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder={
                'Descreva o que você quer que o vídeo se torne. Ex.: "corte de 30s pra TikTok, tom agressivo, ' +
                'foco na dica da proteína, gancho polêmico, filtro cinematográfico"'
              }
            />
          </div>

          <label className="opt-row" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`toggle ${captions ? "on" : ""}`}
              aria-pressed={captions}
              onClick={() => setCaptions((v) => !v)}
            />
            <span>
              <strong>Legendas automáticas</strong>
              <em>{captions ? "ligadas — palavra-a-palavra com destaque" : "desligadas — vídeo sem legenda queimada"}</em>
            </span>
          </label>
        </>
      )}

      {error && <p style={{ textAlign: "center", marginTop: 12 }} className="error-box">{error}</p>}
    </div>
  );
}
