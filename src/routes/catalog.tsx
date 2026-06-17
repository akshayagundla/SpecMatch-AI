import { createFileRoute, Link } from "@tanstack/react-router";
import { listProducts } from "@/lib/products.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Cpu, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Product catalog — SpecMatch AI" },
      {
        name: "description",
        content: "Indexed device catalog: laptops, smartphones, smartwatches and accessories with full specs.",
      },
      { property: "og:title", content: "SpecMatch AI · Catalog" },
    ],
  }),
  component: Catalog,
});

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const SearchSchema = z
  .string()
  .trim()
  .max(80, "Search must be 80 characters or less")
  .regex(/^[a-zA-Z0-9 _\-./+]*$/, "Letters, numbers and basic punctuation only");

function Catalog() {
  const listProductsFn = useServerFn(listProducts);
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: () => listProductsFn() });
  const products = productsQuery.data ?? [];

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onQueryChange(v: string) {
    setQuery(v);
    const parsed = SearchSchema.safeParse(v);
    setError(parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid");
  }

  const filtered = useMemo(() => {
    const q = (!error ? query.trim() : "").toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, query, error]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <Link to="/auth" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gradient-violet)] text-violet-foreground px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-glow)]">
            Open workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">
          <Cpu className="h-3 w-3 text-violet" /> Indexed devices
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          {products.length} devices indexed with full hardware metadata — used as retrieval candidates
          by the compatibility agent.
        </p>

        <div className="mt-6 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search brand, model or category…"
              maxLength={80}
              aria-invalid={!!error}
              className="h-9 text-xs pl-8"
            />
          </div>
          {error ? (
            <p className="mt-1.5 text-[10.5px] text-destructive">{error}</p>
          ) : (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              {filtered.length} of {products.length} shown
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <article key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="aspect-[16/10] bg-surface-2 overflow-hidden">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                    {p.category}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground">
                    {formatPrice(p.price_cents)}
                  </span>
                </div>
                <h2 className="mt-1 text-sm font-semibold tracking-tight">
                  <span className="text-muted-foreground">{p.brand}</span> {p.name}
                </h2>
                <dl className="mt-3 space-y-1 text-[11px]">
                  {Object.entries(p.specs as Record<string, unknown>)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="text-muted-foreground capitalize w-20 shrink-0">{k}</dt>
                        <dd className="font-mono truncate">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

