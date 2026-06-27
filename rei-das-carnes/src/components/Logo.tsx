export default function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Rei das Carnes Açougue">
      <rect width="200" height="200" rx="20" fill="var(--brand-maroon)" />
      <path
        d="M62 78 L78 50 L92 70 L100 48 L108 70 L122 50 L138 78 L132 88 L68 88 Z"
        fill="var(--brand-orange)"
      />
      <rect x="68" y="88" width="64" height="8" fill="var(--brand-orange)" />
      <circle cx="78" cy="58" r="5" fill="var(--brand-maroon)" />
      <circle cx="100" cy="56" r="5" fill="var(--brand-maroon)" />
      <circle cx="122" cy="58" r="5" fill="var(--brand-maroon)" />
      <text
        x="100"
        y="122"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="26"
        fill="var(--brand-cream)"
      >
        REI DAS
      </text>
      <rect x="58" y="132" width="84" height="16" rx="3" fill="var(--brand-cream)" />
      <text
        x="100"
        y="144"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill="var(--brand-maroon)"
      >
        AÇOUGUE
      </text>
      <text
        x="100"
        y="176"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="30"
        fill="var(--brand-red)"
      >
        CARNES
      </text>
    </svg>
  );
}
