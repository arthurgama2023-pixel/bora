import { cn } from "@/lib/utils";

// Marca SS-Chopp: coroa dourada + wordmark (baseada na logo oficial do cliente).
export function CrownMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-brand", className)}
      aria-hidden
    >
      <path
        d="M6 14 L12 24 L18 10 L24 22 L30 10 L36 24 L42 14 L40 32 Q24 38 8 32 Z"
        fill="currentColor"
      />
      <circle cx="6" cy="12" r="2.4" fill="currentColor" />
      <circle cx="18" cy="8" r="2.4" fill="currentColor" />
      <circle cx="30" cy="8" r="2.4" fill="currentColor" />
      <circle cx="42" cy="12" r="2.4" fill="currentColor" />
      <rect x="22.6" y="16" width="2.8" height="8" rx="1" fill="var(--sidebar)" />
    </svg>
  );
}

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const crown = { sm: "h-6 w-7", md: "h-8 w-10", lg: "h-14 w-16" }[size];
  const title = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CrownMark className={crown} />
      <div className="leading-tight">
        <div className={cn("font-black tracking-wider", title)}>
          SS-<span className="text-brand">CHOPP</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          desde 2016
        </div>
      </div>
    </div>
  );
}
