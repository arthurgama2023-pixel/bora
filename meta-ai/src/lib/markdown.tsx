// Mini-renderizador de markdown para o chat (GFM básico: títulos, listas,
// tabelas, negrito, itálico, links e código inline). Sem dependências e sem
// HTML bruto — o conteúdo vem do agente, mas defesa em profundidade é grátis.
import * as React from "react";
import Link from "next/link";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // ordem importa: código > negrito > itálico > link
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const inner = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (inner) {
        const href = inner[2];
        nodes.push(
          href.startsWith("/") ? (
            <Link key={key} href={href}>
              {inner[1]}
            </Link>
          ) : (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {inner[1]}
            </a>
          ),
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Títulos
    const heading = /^(#{2,3})\s+(.*)/.exec(line);
    if (heading) {
      const Tag = heading[1].length === 2 ? "h2" : "h3";
      blocks.push(<Tag key={key++}>{renderInline(heading[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }

    // Tabelas
    if (line.trimStart().startsWith("|") && lines[i + 1]?.includes("---")) {
      const headerCells = line.split("|").slice(1, -1).map((c) => c.trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {headerCells.map((cell, ci) => (
                  <th key={ci}>{renderInline(cell, `th${key}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell, `td${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Listas
    const isBullet = (l: string) => /^\s*[-•]\s+/.test(l);
    const isNumbered = (l: string) => /^\s*\d+\.\s+/.test(l);
    if (isBullet(line) || isNumbered(line)) {
      const numbered = isNumbered(line);
      const items: string[] = [];
      while (i < lines.length && (isBullet(lines[i]) || isNumbered(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-•]|\d+\.)\s+/, ""));
        i++;
      }
      const ListTag = numbered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `li${key}-${ii}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Parágrafo (agrupa linhas consecutivas)
    const parts: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBullet(lines[i]) &&
      !isNumbered(lines[i]) &&
      !lines[i].trimStart().startsWith("|") &&
      !/^#{2,3}\s/.test(lines[i])
    ) {
      parts.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(parts.join(" "), `p${key}`)}</p>);
  }

  return <div className="chat-markdown text-sm leading-relaxed">{blocks}</div>;
}
