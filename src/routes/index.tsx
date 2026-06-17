import { createFileRoute, Link } from "@tanstack/react-router";
import { listProducts } from "@/lib/products.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Cpu, Layers, ScanSearch, Database, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SpecMatch AI — Multimodal RAG Compatibility Agent" },
      {
        name: "description",
        content:
          "Enterprise-grade AI agent that analyzes electronics compatibility from images and natural language, with grounded product recommendations.",
      },
      { property: "og:title", content: "SpecMatch AI — Compatibility Intelligence" },
      {
        property: "og:description",
        content: "Multimodal RAG agent for smartphones, laptops, and smartwatches.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const listProductsFn = useServerFn(listProducts);
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: () => listProductsFn() });
  const preview = productsQuery.data?.slice(0, 6) ?? [];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur">
        <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)]">
              <Cpu className="h-3.5 w-3.5 text-violet-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">SpecMatch AI</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/catalog"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Catalog
            </Link>
            <Link
              to="/auth"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gradient-violet)] text-violet-foreground px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition-all"
            >
              Open workspace <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-violet animate-pulse" />
          <span className="font-mono uppercase tracking-[0.14em]">Multimodal RAG · v1.0</span>
        </div>
        <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
          The compatibility agent for{" "}
          <span className="bg-clip-text text-transparent bg-[var(--gradient-violet)]">
            electronics buyers
          </span>
          .
        </h1>
        <p className="mt-5 text-base text-muted-foreground max-w-2xl leading-relaxed">
          Drop a spec screenshot or describe your setup. SpecMatch AI extracts your hardware
          profile, retrieves the right candidates from a curated catalog, and returns a grounded
          compatibility analysis — citing ports, protocols, and ecosystem locks.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--gradient-violet)] text-violet-foreground px-4 py-2 text-sm font-medium shadow-[var(--shadow-glow)] hover:brightness-110 transition-all"
          >
            Start an analysis <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            Browse catalog
          </Link>
        </div>

        {/* Pipeline diagram */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { icon: ScanSearch, label: "Vision extract", desc: "Image → structured spec JSON" },
            { icon: Database, label: "Semantic retrieve", desc: "Embedding cosine over catalog" },
            { icon: Layers, label: "Ground", desc: "Top candidates injected as context" },
            { icon: Sparkles, label: "Reason", desc: "Solutions architect prompt + scoring" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card/60 p-4 relative"
            >
              <div className="absolute top-3 right-3 text-[10px] font-mono text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <s.icon className="h-4 w-4 text-violet" />
              <p className="mt-3 text-sm font-medium">{s.label}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog preview */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-border/50">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">
              Indexed catalog
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Curated devices and accessories</h2>
          </div>
          <Link to="/catalog" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {preview.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="aspect-[16/10] bg-surface-2 overflow-hidden">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{p.category}</p>
                <p className="text-sm font-medium tracking-tight mt-0.5 truncate">{p.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© SpecMatch AI</span>
          <span className="font-mono">multimodal · rag · grounded</span>
        </div>
      </footer>
    </div>
  );
}
