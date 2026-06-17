import type { ChatRecommendation } from "@/lib/chat.functions";
import { Sparkles } from "lucide-react";

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function scoreColor(score: number) {
  if (score >= 85) return "text-[oklch(0.74_0.16_155)]";
  if (score >= 65) return "text-[oklch(0.78_0.16_70)]";
  return "text-muted-foreground";
}

export function RecommendationGrid({ recommendations }: { recommendations: ChatRecommendation[] }) {
  if (recommendations.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="h-3 w-3 text-violet" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Recommended · ranked by compatibility
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {recommendations.map((r) => (
          <article
            key={r.product_id}
            className="group relative overflow-hidden rounded-lg border border-border bg-card hover:border-violet/40 transition-colors"
          >
            <div className="aspect-[16/10] bg-surface-2 overflow-hidden">
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.name}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">
                  No image
                </div>
              )}
            </div>
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-background/85 backdrop-blur border border-border text-[11px] font-mono tabular-nums">
              <span className={scoreColor(r.score)}>{r.score}%</span>
              <span className="text-muted-foreground"> match</span>
            </div>
            <div className="p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold tracking-tight truncate">
                  <span className="text-muted-foreground">{r.brand}</span> {r.name}
                </h3>
                <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                  {formatPrice(r.price_cents)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{r.reason}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
