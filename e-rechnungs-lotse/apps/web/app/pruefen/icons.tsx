import type { Ampel } from "@erl/core";

const common = {
  "aria-hidden": true,
  focusable: false,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function AmpelIcon({ symbol, className }: { symbol: Ampel["symbol"]; className?: string }) {
  switch (symbol) {
    case "haken":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="m7.5 12.5 3 3 6-6.5" />
        </svg>
      );
    case "ausrufezeichen":
      return (
        <svg {...common} className={className}>
          <path d="M12 3 2 21h20L12 3Z" />
          <path d="M12 10v5M12 18h.01" />
        </svg>
      );
    case "kreuz":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
        </svg>
      );
    case "dokument":
      return (
        <svg {...common} className={className}>
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      );
  }
}

export function SchlossIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function UploadIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}
