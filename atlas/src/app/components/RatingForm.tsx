import { DIMENSIONS, type Dimension } from "../../domain/dimensions.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import rubric from "../../domain/rubric.json";
import type { Rating } from "../../domain/types.js";

const LEVELS = rubric.levels as Record<string, Record<string, string>>;

interface Props {
  ratings: Rating[];
  onChange: (ratings: Rating[]) => void;
  idPrefix: string;
}

/**
 * Six chips, multi-select by design: the same crumbling ramp is physical and
 * economic if the repair budget is why it stays broken.
 */
export function RatingForm({ ratings, onChange, idPrefix }: Props) {
  const byDimension = new Map(ratings.map((r) => [r.dimension, r]));

  const toggle = (dimension: Dimension) => {
    if (byDimension.has(dimension)) onChange(ratings.filter((r) => r.dimension !== dimension));
    else onChange([...ratings, { dimension, score: null }]);
  };

  const patch = (dimension: Dimension, partial: Partial<Rating>) =>
    onChange(ratings.map((r) => (r.dimension === dimension ? { ...r, ...partial } : r)));

  return (
    <div className="space-y-3">
      <fieldset className="border-0 p-0">
        <legend className="mb-2 text-xs font-semibold text-slate-700">Dimensions evaluees</legend>
        <div className="flex flex-wrap gap-1.5">
          {DIMENSIONS.map((meta) => {
            const active = byDimension.has(meta.key);
            return (
              <label key={meta.key} className={`chip ${active ? "chip-active" : ""}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() => toggle(meta.key)}
                />
                <span
                  className="chip-dot"
                  aria-hidden="true"
                  style={{ background: active ? "#ffffff" : meta.colour }}
                />
                {/* The code is spelled out so the choice never rests on colour alone. */}
                {meta.mjslCode} · {meta.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {ratings.map((rating) => {
        const meta = DIMENSIONS.find((d) => d.key === rating.dimension)!;
        const sliderId = `${idPrefix}-${rating.dimension}-score`;
        const unrated = rating.score === null;
        return (
          <div
            key={rating.dimension}
            className="rounded-md border p-3"
            style={{ borderColor: "var(--line)", borderLeft: `3px solid ${meta.colour}` }}
          >
            <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
            <p className="mb-2 text-xs text-slate-500">{meta.hints}</p>

            <label htmlFor={sliderId} className="block text-xs font-medium text-slate-700">
              Note : <span className="font-semibold text-slate-900">{unrated ? "non renseignee" : rating.score}</span>
              {!unrated && ` / ${DEFAULT_CONFIG.scaleMax}`}
            </label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={DEFAULT_CONFIG.scaleMax}
              step={DEFAULT_CONFIG.scaleStep}
              value={rating.score ?? 0}
              onChange={(e) => patch(rating.dimension, { score: Number(e.target.value) })}
              // The rubric wording travels with the control for screen readers too.
              aria-describedby={`${sliderId}-help`}
              className="w-full"
              style={{ accentColor: meta.colour }}
            />
            <p id={`${sliderId}-help`} className="text-xs text-slate-600">
              {unrated
                ? "Deplace le curseur pour noter, ou laisse non renseigne."
                : LEVELS[rating.dimension]?.[String(Math.round(rating.score!))] ?? ""}
            </p>

            {!unrated && (
              <button
                type="button"
                onClick={() => patch(rating.dimension, { score: null })}
                className="btn btn-ghost btn-sm mt-1 px-0"
              >
                Remettre a « non renseigne »
              </button>
            )}

            <label className="mt-2 block text-xs font-medium text-slate-700" htmlFor={`${sliderId}-comment`}>
              Commentaire
            </label>
            <textarea
              id={`${sliderId}-comment`}
              value={rating.comment ?? ""}
              onChange={(e) => patch(rating.dimension, { comment: e.target.value })}
              rows={2}
              className="w-full rounded-md border p-1.5 text-sm"
              style={{ borderColor: "var(--line-strong)" }}
            />
          </div>
        );
      })}
    </div>
  );
}
