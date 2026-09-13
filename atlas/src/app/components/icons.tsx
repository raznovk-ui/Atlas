/**
 * Minimal stroke icons, 20x20, currentColor. Hand-rolled rather than adding an
 * icon library for a dozen glyphs. Every use pairs the icon with a text label
 * elsewhere in the control -- icons here are reinforcement, never the only
 * identifier of what a button does.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 18s6-5.2 6-9.6A6 6 0 0 0 4 8.4C4 12.8 10 18 10 18Z" />
      <circle cx="10" cy="8.3" r="2.2" />
    </svg>
  );
}

export function IconAlertTriangle({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 3.2 17.5 16H2.5L10 3.2Z" />
      <path d="M10 8v3.2" />
      <circle cx="10" cy="13.8" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 13V3.5" />
      <path d="M6 7.2 10 3l4 4.2" />
      <path d="M3.5 13v2.3A1.7 1.7 0 0 0 5.2 17h9.6a1.7 1.7 0 0 0 1.7-1.7V13" />
    </svg>
  );
}

export function IconCamera({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7.2A1.2 1.2 0 0 1 4.2 6h2l1-1.6h5.6L13.8 6h2A1.2 1.2 0 0 1 17 7.2v7.6A1.2 1.2 0 0 1 15.8 16H4.2A1.2 1.2 0 0 1 3 14.8V7.2Z" />
      <circle cx="10" cy="10.6" r="2.6" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 3v9.5" />
      <path d="M6 9.2 10 13l4-3.8" />
      <path d="M3.5 15v1.3A1.7 1.7 0 0 0 5.2 18h9.6a1.7 1.7 0 0 0 1.7-1.7V15" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5h12" />
      <path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M5.5 5.5 6.1 16a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9l0.6-10.5" />
      <path d="M8.3 8.5v5" />
      <path d="M11.7 8.5v5" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function IconUndo({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 8H12a4 4 0 0 1 0 8H8" />
      <path d="M7.8 5 5 8l2.8 3" />
    </svg>
  );
}

export function IconLayers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 3 3 7.2 10 11.4l7-4.2L10 3Z" />
      <path d="M3 11l7 4.2L17 11" />
    </svg>
  );
}
