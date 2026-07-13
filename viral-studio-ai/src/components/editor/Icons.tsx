// Ícones do editor — desenhos vetoriais profissionais (traço fino, estilo
// ferramenta de edição), substituem todos os emojis do painel. currentColor
// permite colorir via CSS; ícones "cheios" (play/pause/sparkles) usam fill.
import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "x" | "chevronLeft" | "undo" | "redo" | "play" | "pause"
  | "scissors" | "gauge" | "zoomIn" | "filter" | "captions" | "textT"
  | "music" | "volume" | "volumeX" | "chart" | "sparkles" | "trash"
  | "pencil" | "check" | "checkCircle" | "alertTriangle" | "alertCircle"
  | "download" | "share" | "reset" | "upDown" | "fontSize" | "mic"
  | "bolt" | "film" | "rocket" | "clapper" | "briefcase" | "flame"
  | "dumbbell" | "hook" | "target" | "clock" | "slashCircle"
  | "search" | "plus";

const P: Record<IconName, ReactNode> = {
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  play: (
    <path
      d="M8 5.4v13.2a.7.7 0 0 0 1.05.6l10.9-6.6a.7.7 0 0 0 0-1.2L9.05 4.8A.7.7 0 0 0 8 5.4z"
      fill="currentColor"
      stroke="none"
    />
  ),
  pause: (
    <>
      <rect x="6.6" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" stroke="none" />
      <rect x="13.8" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M20 4L8.2 15.8" />
      <path d="M14.5 14.5L20 20" />
      <path d="M8.2 8.2l3.8 3.8" />
    </>
  ),
  gauge: (
    <>
      <path d="M20.4 17.8a9.5 9.5 0 1 0-16.8 0" />
      <path d="M12 14.5l4.2-4.7" />
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
      <path d="M11 8.6v4.8M8.6 11h4.8" />
    </>
  ),
  filter: (
    <>
      <circle cx="12" cy="8.4" r="4.7" />
      <circle cx="8.4" cy="14.8" r="4.7" />
      <circle cx="15.6" cy="14.8" r="4.7" />
    </>
  ),
  captions: (
    <>
      <rect x="3" y="5.2" width="18" height="13.6" rx="2.8" />
      <path d="M6.6 12.2h4.2M6.6 15.2h7.8" />
    </>
  ),
  textT: (
    <>
      <path d="M5.5 7V5h13v2" />
      <path d="M12 5v14" />
      <path d="M9.5 19h5" />
    </>
  ),
  music: (
    <>
      <path d="M9.6 17.4V6.2l9-1.8v10.8" />
      <circle cx="7" cy="17.4" r="2.6" />
      <circle cx="16" cy="15.2" r="2.6" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.4v5.2h3.4L12 18.4V5.6L7.4 9.4z" />
      <path d="M15.4 9.2a4.3 4.3 0 0 1 0 5.6" />
      <path d="M17.9 6.9a8 8 0 0 1 0 10.2" />
    </>
  ),
  volumeX: (
    <>
      <path d="M4 9.4v5.2h3.4L12 18.4V5.6L7.4 9.4z" />
      <path d="M15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20v-7.5" />
      <path d="M12 20V4.5" />
      <path d="M19 20v-5.5" />
    </>
  ),
  sparkles: (
    <>
      <path
        d="M11 4.6l1.6 4.2 4.2 1.6-4.2 1.6L11 16.2 9.4 12 5.2 10.4 9.4 8.8z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M18.2 13.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.6 7V5a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v2" />
      <path d="M6.4 7l.8 12.3a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5L17.6 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pencil: (
    <>
      <path d="M16.8 3.8l3.4 3.4L8.4 19 3.6 20.4 5 15.6z" />
      <path d="M14.6 6l3.4 3.4" />
    </>
  ),
  check: <path d="M5 13l4.5 4.5L19 7" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.4l2.5 2.5 4.7-5.2" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 4.4l8.6 14.9H3.4z" />
      <path d="M12 10.2v4" />
      <path d="M12 17.3h.01" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5v10" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  share: (
    <>
      <path d="M12 14.5V4.2" />
      <path d="M7.8 8L12 3.8 16.2 8" />
      <path d="M4.5 13.5v5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4.5V9h4.5" />
    </>
  ),
  upDown: (
    <>
      <path d="M12 4.5v15" />
      <path d="M8.5 8L12 4.5 15.5 8" />
      <path d="M8.5 16L12 19.5 15.5 16" />
    </>
  ),
  fontSize: (
    <>
      <path d="M4 18L9 5.8 14 18" />
      <path d="M6 13.6h6" />
      <path d="M18 17.5v-8" />
      <path d="M15.5 12L18 9.5 20.5 12" />
    </>
  ),
  mic: (
    <>
      <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 17.5v3" />
    </>
  ),
  bolt: <path d="M13 3L5.5 13.5h5L11 21l7.5-10.5h-5z" />,
  film: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" />
      <path d="M8 4.5v15M16 4.5v15" />
      <path d="M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
    </>
  ),
  rocket: (
    <>
      <path d="M12.4 15.1c4.8-2.9 6.9-7 6.9-11.4-4.4 0-8.5 2.1-11.4 6.9l-3.2 1 3.7 3.7 3.7 3.7 1-3.2z" />
      <circle cx="14.2" cy="9.8" r="1.5" />
      <path d="M6.8 17.2c-1.2 1.2-1.8 3.4-1.8 3.4s2.2-.6 3.4-1.8" />
    </>
  ),
  clapper: (
    <>
      <rect x="3.5" y="9.2" width="17" height="10.3" rx="2" />
      <path d="M3.7 9.2L5 4.8l15.4 2.4-.7 2" />
      <path d="M8.4 5.4l1.5 3.6M13.3 6.2l1.5 3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="4" y="8" width="16" height="11.5" rx="2" />
      <path d="M9.5 8V6.2a1.7 1.7 0 0 1 1.7-1.7h1.6a1.7 1.7 0 0 1 1.7 1.7V8" />
      <path d="M4 12.6h16" />
    </>
  ),
  flame: (
    <path d="M12 3.6c.9 2.9-3.6 4.6-3.6 8.6a5.6 5.6 0 0 0 11.2 0c0-2-.9-3.6-2-4.7-.3 1.1-.9 2-1.9 2.5.4-2.9-1-6.4-3.7-6.4z" />
  ),
  dumbbell: (
    <>
      <path d="M7 8v8M4.5 9.6v4.8M17 8v8M19.5 9.6v4.8" />
      <path d="M7 12h10" />
    </>
  ),
  hook: (
    <>
      <circle cx="15" cy="5" r="1.7" />
      <path d="M15 6.8v6a5 5 0 0 1-10 0v-1.6" />
      <path d="M5 11.2L3.3 9.7" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  slashCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 6.2l11.6 11.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L20.5 20.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

export default function Ic({
  name,
  size = 22,
  strokeWidth = 1.8,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}
