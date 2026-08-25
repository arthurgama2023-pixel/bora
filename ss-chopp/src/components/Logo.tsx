export default function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="SS-Chopp Distribuidora">
      <circle cx="100" cy="100" r="96" fill="var(--brand-gold)" />
      <circle cx="100" cy="100" r="86" fill="var(--brand-black)" />

      {/* cross above crown */}
      <rect x="97" y="20" width="6" height="16" fill="var(--brand-cream)" />
      <rect x="91" y="25" width="18" height="6" fill="var(--brand-cream)" />

      {/* stars */}
      <text
        x="100"
        y="46"
        textAnchor="middle"
        fontSize="14"
        letterSpacing="3"
        fill="var(--brand-gold)"
      >
        ★ ★ ★ ★ ★
      </text>

      {/* crown */}
      <path
        d="M68 64 L80 44 L91 60 L100 40 L109 60 L120 44 L132 64 L126 74 L74 74 Z"
        fill="var(--brand-cream)"
      />
      <rect x="74" y="74" width="52" height="6" fill="var(--brand-cream)" />

      {/* shield */}
      <path
        d="M60 84 H140 V120 C140 140 122 150 100 156 C78 150 60 140 60 120 Z"
        fill="none"
        stroke="var(--brand-gold)"
        strokeWidth="2"
        opacity="0.5"
      />

      <text
        x="100"
        y="100"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="17"
        fill="var(--brand-cream)"
      >
        SS-CHOPP
      </text>

      {/* beer glass */}
      <path
        d="M85 110 H115 L111 142 H89 Z"
        fill="var(--brand-amber)"
      />
      <ellipse cx="100" cy="110" rx="15" ry="6" fill="#fff" opacity="0.95" />
      <ellipse cx="100" cy="106" rx="11" ry="4" fill="#fff" opacity="0.85" />

      {/* hops leaves */}
      <ellipse cx="66" cy="118" rx="9" ry="14" fill="var(--brand-gold)" opacity="0.85" transform="rotate(-20 66 118)" />
      <ellipse cx="134" cy="118" rx="9" ry="14" fill="var(--brand-gold)" opacity="0.85" transform="rotate(20 134 118)" />

      {/* ribbon */}
      <rect x="58" y="150" width="84" height="18" rx="2" fill="var(--brand-gold)" />
      <text
        x="100"
        y="163"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="10"
        fill="var(--brand-black)"
      >
        DESDE 2016
      </text>
    </svg>
  );
}
