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
        <legend className="mb-2 text-sm font-semibold">Dimensions evaluees</legend>
        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((meta) => {
            const active = byDimension.has(meta.key);
            return (
              <label
                key={meta.key}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() => toggle(meta.key)}
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
          <div key={rating.dimension} className="rounded border border-slate-200 p-3">
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="mb-2 text-xs text-slate-600">{meta.hints}</p>

            <label htmlFor={sliderId} className="block text-xs font-medium">
              Note : {unrated ? "non renseignee" : rating.score}
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
                className="mt-1 text-xs underline"
              >
                Remettre a « non renseigne »
              </button>
            )}

            <label className="mt-2 block text-xs font-medium" htmlFor={`${sliderId}-comment`}>
              Commentaire
            </label>
            <textarea
              id={`${sliderId}-comment`}
              value={rating.comment ?? ""}
              onChange={(e) => patch(rating.dimension, { comment: e.target.value })}
              rows={2}
              className="w-full rounded border border-slate-300 p-1 text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}
