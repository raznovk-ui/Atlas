/**
 * Inline SVG charts. No chart library: these are three small forms, and owning
 * the markup is what lets every one of them carry a real table alternative and
 * text labels rather than colour alone.
 *
 * One hue throughout. The job here is magnitude, not identity, so a sequential
 * single hue is the correct encoding and no categorical palette is in play.
 */
export const SERIES = "#2a78d6";
export const MUTED = "#94a3b8";

interface BarDatum {
  key: string;
  label: string;
  value: number | null;
  /** Shown under the label; e.g. how many cells backed the figure. */
  note?: string;
}

export function BarChart({
  data,
  max,
  caption,
  unit = "",
}: {
  data: BarDatum[];
  max: number;
  caption: string;
  unit?: string;
}) {
  const rows = data.length;
  const rowHeight = 26;
  const height = rows * rowHeight + 4;
  const labelWidth = 132;
  const trackWidth = 150;

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-xs font-medium text-slate-800">{caption}</figcaption>
      <svg
        width="100%"
        viewBox={`0 0 ${labelWidth + trackWidth + 46} ${height}`}
        role="img"
        aria-label={`${caption}. ${data
          .map((d) => `${d.label} ${d.value === null ? "non renseignee" : `${d.value.toFixed(2)}${unit}`}`)
          .join(". ")}`}
      >
        {data.map((datum, index) => {
          const y = index * rowHeight;
          const ratio = datum.value === null ? 0 : Math.max(0, Math.min(1, datum.value / max));
          return (
            <g key={datum.key}>
              <text x={0} y={y + 15} fontSize={11} fill="#0f172a">
                {datum.label}
              </text>
              <rect x={labelWidth} y={y + 5} width={trackWidth} height={12} rx={4} fill="#e2e8f0" />
              {datum.value !== null && (
                <rect
                  x={labelWidth}
                  y={y + 5}
                  width={Math.max(2, ratio * trackWidth)}
                  height={12}
                  rx={4}
                  fill={SERIES}
                />
              )}
              {/* Direct label on every row: the value is the point, and this
                  removes any dependence on reading a bar against an axis. */}
              <text x={labelWidth + trackWidth + 6} y={y + 15} fontSize={11} fill="#334155">
                {datum.value === null ? "—" : `${datum.value.toFixed(2)}${unit}`}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-slate-600">Voir les valeurs</summary>
        <table className="mt-1 w-full border-collapse text-left text-xs">
          <tbody>
            {data.map((datum) => (
              <tr key={datum.key} className="border-b border-slate-100">
                <th scope="row" className="py-1 pr-2 font-normal">
                  {datum.label}
                </th>
                <td className="py-1 pr-2">
                  {datum.value === null ? "non renseignee" : `${datum.value.toFixed(2)}${unit}`}
                </td>
                <td className="py-1 text-slate-600">{datum.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function Histogram({
  bins,
  caption,
}: {
  bins: { label: string; count: number }[];
  caption: string;
}) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const width = 260;
  const height = 90;
  const gap = 4;
  const barWidth = (width - gap * (bins.length - 1)) / bins.length;

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-xs font-medium text-slate-800">{caption}</figcaption>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height + 18}`}
        role="img"
        aria-label={`${caption}. ${bins.map((b) => `${b.label} : ${b.count}`).join(". ")}`}
      >
        {bins.map((bin, index) => {
          const barHeight = (bin.count / max) * height;
          const x = index * (barWidth + gap);
          return (
            <g key={bin.label}>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={Math.max(bin.count > 0 ? 2 : 0, barHeight)}
                rx={4}
                fill={bin.count > 0 ? SERIES : MUTED}
              />
              <text x={x + barWidth / 2} y={height + 12} fontSize={9} textAnchor="middle" fill="#475569">
                {bin.label}
              </text>
              {bin.count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height - barHeight - 3}
                  fontSize={9}
                  textAnchor="middle"
                  fill="#334155"
                >
                  {bin.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="text-xs text-slate-600">{note}</p>}
    </div>
  );
}
