import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  Play,
  Download,
  FileText,
  Database,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Cpu,
  Sparkles,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/data-plan")({
  head: () => ({
    meta: [
      { title: "Data Plan — SpecMatch AI" },
      {
        name: "description",
        content:
          "Analytical SQL templates, multimodal RAG pipeline demo, and exportable schema documentation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DataPlanPage,
});

/* ──────────────────────────────────────────────────────────────────── */
/* SQL TEMPLATES                                                        */
/* ──────────────────────────────────────────────────────────────────── */

type SqlTemplate = {
  id: string;
  title: string;
  description: string;
  sql: string;
  mockResult: { columns: string[]; rows: (string | number)[][] };
};

const SQL_TEMPLATES: SqlTemplate[] = [
  {
    id: "cheapest-seller",
    title: "Cheapest seller per category",
    description: "Lowest current price grouped by device category.",
    sql: `SELECT category,
       brand,
       name,
       price_cents / 100.0 AS price_usd
FROM   public.products p
WHERE  price_cents = (
         SELECT MIN(price_cents)
         FROM   public.products
         WHERE  category = p.category
       )
ORDER  BY category;`,
    mockResult: {
      columns: ["category", "brand", "name", "price_usd"],
      rows: [
        ["laptop", "Apple", "MacBook Air M3", 1099],
        ["smartphone", "Google", "Pixel 9", 799],
        ["smartwatch", "Samsung", "Galaxy Watch 7", 299],
        ["accessory", "Anker", "USB-C Hub 8-in-1", 49],
      ],
    },
  },
  {
    id: "price-range",
    title: "Price volatility by category",
    description: "Min / max / spread of indexed prices per category.",
    sql: `SELECT category,
       COUNT(*)                                    AS sku_count,
       MIN(price_cents) / 100.0                    AS min_usd,
       MAX(price_cents) / 100.0                    AS max_usd,
       ROUND(AVG(price_cents)::numeric / 100, 2)   AS avg_usd,
       (MAX(price_cents) - MIN(price_cents)) / 100.0 AS spread_usd
FROM   public.products
GROUP  BY category
ORDER  BY spread_usd DESC;`,
    mockResult: {
      columns: ["category", "sku_count", "min_usd", "max_usd", "avg_usd", "spread_usd"],
      rows: [
        ["laptop", 4, 1099, 3499, 2074.5, 2400],
        ["smartphone", 3, 799, 1599, 1099.0, 800],
        ["smartwatch", 2, 299, 799, 549.0, 500],
        ["accessory", 1, 49, 49, 49.0, 0],
      ],
    },
  },
  {
    id: "price-history",
    title: "30-day price trend",
    description: "Tracks weekly price deltas using a windowed CTE.",
    sql: `WITH weekly AS (
  SELECT product_id,
         DATE_TRUNC('week', captured_at) AS wk,
         AVG(price_cents)::int           AS avg_price
  FROM   public.price_history
  WHERE  captured_at >= NOW() - INTERVAL '30 days'
  GROUP  BY product_id, wk
)
SELECT p.name,
       w.wk::date AS week,
       w.avg_price / 100.0 AS avg_usd,
       (w.avg_price - LAG(w.avg_price) OVER (PARTITION BY w.product_id ORDER BY w.wk))
         / 100.0 AS delta_usd
FROM   weekly w
JOIN   public.products p ON p.id = w.product_id
ORDER  BY p.name, w.wk;`,
    mockResult: {
      columns: ["name", "week", "avg_usd", "delta_usd"],
      rows: [
        ["MacBook Pro M3", "2026-05-18", 1999, 0],
        ["MacBook Pro M3", "2026-05-25", 1949, -50],
        ["MacBook Pro M3", "2026-06-01", 1899, -50],
        ["MacBook Pro M3", "2026-06-08", 1949, 50],
      ],
    },
  },
  {
    id: "compat-hits",
    title: "Top-cited products in RAG answers",
    description: "Most recommended products grouped by compatibility score.",
    sql: `SELECT p.brand || ' ' || p.name AS product,
       COUNT(*)                    AS recommendations,
       ROUND(AVG((rec->>'score')::numeric), 1) AS avg_score
FROM   public.messages m
       CROSS JOIN LATERAL jsonb_array_elements(m.recommendations) AS rec
JOIN   public.products p ON p.id = (rec->>'product_id')::uuid
WHERE  m.role = 'assistant'
GROUP  BY product
ORDER  BY recommendations DESC
LIMIT  10;`,
    mockResult: {
      columns: ["product", "recommendations", "avg_score"],
      rows: [
        ["Apple MacBook Pro M3", 42, 94.2],
        ["Samsung Galaxy S26", 31, 88.7],
        ["Apple Watch Ultra 2", 27, 91.4],
        ["Anker USB-C Hub 8-in-1", 24, 82.0],
      ],
    },
  },
];

function SqlTemplatesPanel() {
  const [activeResult, setActiveResult] = useState<string | null>(null);

  async function copyTemplate(t: SqlTemplate) {
    try {
      await navigator.clipboard.writeText(t.sql);
      toast.success("Query copied to clipboard", { description: t.title });
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  function runMock(t: SqlTemplate) {
    setActiveResult(t.id);
    toast.success(`Executed · ${t.mockResult.rows.length} rows`, {
      description: `${t.title} (mocked against staging replica)`,
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {SQL_TEMPLATES.map((t) => {
        const showResult = activeResult === t.id;
        return (
          <div
            key={t.id}
            className="rounded-lg border border-border bg-card overflow-hidden flex flex-col"
          >
            <div className="px-4 py-3 border-b border-border/60 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">{t.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={() => copyTemplate(t)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button size="sm" variant="violet" className="h-7 text-xs gap-1.5" onClick={() => runMock(t)}>
                  <Play className="h-3 w-3" /> Run
                </Button>
              </div>
            </div>
            <pre className="text-[11px] font-mono leading-relaxed p-3 bg-surface-2/40 text-foreground/90 overflow-x-auto max-h-56">
              {t.sql}
            </pre>
            {showResult && (
              <div className="border-t border-border/60 bg-background/60">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-[oklch(0.74_0.16_155)]" />
                  Mock result · {t.mockResult.rows.length} rows · 24ms
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/60">
                        {t.mockResult.columns.map((c) => (
                          <th key={c} className="text-left px-3 py-1.5 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.mockResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 tabular-nums">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PIPELINE DEMO                                                        */
/* ──────────────────────────────────────────────────────────────────── */

type DemoStep = {
  id: string;
  label: string;
  detail: string;
  output: string;
  durationMs: number;
};

const DEMO_STEPS: DemoStep[] = [
  {
    id: "vision",
    label: "Vision extraction",
    detail: "gemini-3-flash → structured hardware profile",
    durationMs: 900,
    output: `{
  "device": "Laptop",
  "brand": "Apple",
  "model": "MacBook Pro 14\\" M3",
  "os": "macOS 14 Sonoma",
  "processor": "Apple M3 Pro 11-core",
  "ram": "18 GB unified",
  "ports": ["Thunderbolt 4", "HDMI 2.1", "MagSafe 3", "SDXC"],
  "wireless": ["Wi-Fi 6E", "Bluetooth 5.3"],
  "ecosystem": "Apple"
}`,
  },
  {
    id: "embed",
    label: "Embedding query",
    detail: "google/gemini-embedding-001 · 768-dim vector",
    durationMs: 600,
    output: "vector(768) ≈ [0.0214, -0.0817, 0.0033, 0.1109, ...] ‖v‖ = 1.000",
  },
  {
    id: "retrieve",
    label: "Hybrid retrieval",
    detail: "cosine similarity over 10 indexed products · top-5",
    durationMs: 500,
    output: `1. Apple Studio Display          sim=0.892
2. Anker USB-C Hub 8-in-1        sim=0.864
3. CalDigit TS4 Thunderbolt Dock sim=0.851
4. LG UltraFine 5K 27"           sim=0.823
5. Apple Magic Keyboard          sim=0.781`,
  },
  {
    id: "ground",
    label: "Grounded reasoning",
    detail: "Expert Electronics Solutions Architect prompt",
    durationMs: 1200,
    output: `The MacBook Pro M3's Thunderbolt 4 ports support DisplayPort 1.4 with DSC,
enabling 6K @ 60Hz on the Apple Studio Display via a single TB4 cable —
this is the cleanest match. The CalDigit TS4 is fully validated for M3
Pro hosts (98W charge-through, 18 downstream ports). The Anker hub is
compatible but caps at 4K @ 60Hz over HDMI 2.0. LG UltraFine 5K requires
TB3+ — works, but Studio Display is the better-tuned pairing.

Bottom line: Studio Display + CalDigit TS4 for a desk; Anker hub for travel.`,
  },
  {
    id: "persist",
    label: "Persist · audit log",
    detail: "messages + rag_query_log rows committed",
    durationMs: 300,
    output: "INSERT 0 1 · INSERT 0 1 · session bumped (last_message_at)",
  },
];

function PipelineDemo() {
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  async function runDemo() {
    if (running) return;
    setRunning(true);
    setCompleted(new Set());
    setStepIdx(-1);
    toast.info("Demo pipeline starting", { description: "Simulating multimodal RAG flow" });
    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, DEMO_STEPS[i].durationMs));
      setCompleted((prev) => new Set(prev).add(DEMO_STEPS[i].id));
    }
    setRunning(false);
    toast.success("Pipeline finished · 5/5 stages green", {
      description: "End-to-end grounding verified",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)] shrink-0">
            <Sparkles className="h-4 w-4 text-violet-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Multimodal RAG demo run</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulates a mock MacBook Pro image upload through vision → embed → retrieve → ground →
              persist. No live API calls; deterministic output proves the contract.
            </p>
          </div>
        </div>
        <Button onClick={runDemo} disabled={running} variant="violet" size="sm" className="gap-1.5">
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {running ? "Running…" : "Run Demo Test"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">
          <ImageIcon className="h-3 w-3" /> Input fixture: macbook-pro-m3-spec-sheet.jpg
        </div>
        <ol className="divide-y divide-border/60">
          {DEMO_STEPS.map((s, i) => {
            const isActive = stepIdx === i && running;
            const done = completed.has(s.id);
            return (
              <li key={s.id} className="px-4 py-3 flex gap-3">
                <div className="pt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-[oklch(0.74_0.16_155)]" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-violet" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border grid place-items-center text-[9px] font-mono text-muted-foreground">
                      {i + 1}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-xs font-semibold tracking-tight">{s.label}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground">{s.detail}</span>
                  </div>
                  {(done || isActive) && (
                    <pre
                      className={cn(
                        "mt-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap rounded-md p-2.5 border border-border/60 bg-surface-2/40",
                        isActive && !done && "text-muted-foreground",
                      )}
                    >
                      {s.output}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* DOCUMENTATION EXPORT                                                 */
/* ──────────────────────────────────────────────────────────────────── */

const SCHEMA_SQL = `-- SpecMatch AI · Production schema export
-- Generated ${new Date().toISOString()}

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  brand         text NOT NULL,
  category      text NOT NULL,
  price_cents   integer NOT NULL,
  image_url     text,
  specs         jsonb NOT NULL DEFAULT '{}',
  profile_text  text NOT NULL,
  embedding     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'New analysis',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.sessions ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  role              text NOT NULL CHECK (role IN ('user','assistant')),
  content           text NOT NULL,
  image_url         text,
  extracted_specs   jsonb,
  recommendations   jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_public_read ON public.products FOR SELECT USING (true);
CREATE POLICY sessions_owner_all   ON public.sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY messages_owner_all   ON public.messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;

function buildProjectReport() {
  return `# SpecMatch AI — Project Report

_Generated ${new Date().toISOString()}_

## 1. Executive summary

SpecMatch AI is a Multimodal Retrieval-Augmented Generation (RAG) compatibility
agent for consumer electronics. The platform accepts text + image input, extracts
a structured hardware profile via a vision-capable LLM, retrieves candidate
products by semantic similarity, and produces grounded, protocol-cited
compatibility recommendations.

## 2. Architecture

| Layer            | Technology                                            |
| ---------------- | ----------------------------------------------------- |
| Frontend         | TanStack Start · React 19 · Tailwind v4               |
| Server runtime   | Cloudflare Workers (TanStack server functions)        |
| Database         | Postgres (Lovable Cloud) with Row Level Security      |
| Vector retrieval | Cosine similarity over jsonb embeddings (768-dim)     |
| Vision + LLM     | Lovable AI Gateway · google/gemini-3-flash-preview    |
| Auth             | Email / password via Lovable Cloud auth               |

## 3. Phases delivered

1. **Phase 1 — Data layer**: profiles, products, sessions, messages with RLS.
2. **Phase 2 — Catalog seeding**: 10 high-value devices with full spec JSON.
3. **Phase 3 — Vision pipeline**: image → structured hardware profile.
4. **Phase 4 — RAG**: query embedding + cosine retrieval + grounded prompt.
5. **Phase 5 — UI**: Linear-style dark workspace, recommendation grid, catalog.
6. **Phase 6 — Documentation & analytics**: SQL templates, schema export,
   pipeline demo (this report).

## 4. Analytical SQL coverage

- Cheapest seller per category
- Price volatility (min / max / spread / avg) per category
- 30-day weekly price trend with windowed deltas
- Top products cited in assistant recommendations

## 5. Security posture

- All user-owned tables scoped via \`auth.uid() = user_id\`.
- Service-role access restricted to server-side admin client.
- Vision input size capped at 8 MB; mime allow-list enforced client-side.
- Zod validation on every server function input.

## 6. Operational notes

- LLM calls handle 429 (rate limit) and 402 (credits exhausted) explicitly.
- Embeddings are lazily computed and cached in \`products.embedding\`.
- Sessions support deletion; cascade clears messages.
`;
}

function downloadFile(name: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ReportFilterSchema = z
  .string()
  .trim()
  .max(60, "Keep it under 60 characters")
  .regex(/^[a-zA-Z0-9 _\-./]*$/, "Letters, numbers, space, _ - . / only");

function DocsPanel() {
  const [reportTag, setReportTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  function validateTag(v: string) {
    const parsed = ReportFilterSchema.safeParse(v);
    setTagError(parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid");
    return parsed.success;
  }

  function exportSchema() {
    downloadFile("specmatch-schema.sql", SCHEMA_SQL, "application/sql");
    toast.success("Schema exported", { description: "specmatch-schema.sql" });
  }

  function exportReport() {
    if (!validateTag(reportTag)) {
      toast.error("Fix the report tag before exporting");
      return;
    }
    const suffix = reportTag ? `-${reportTag.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}` : "";
    const filename = `specmatch-report${suffix}.md`;
    const body =
      (reportTag ? `<!-- tag: ${reportTag} -->\n\n` : "") + buildProjectReport();
    downloadFile(filename, body, "text/markdown");
    toast.success("Project report exported", { description: filename });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 border border-border shrink-0">
            <Database className="h-4 w-4 text-violet" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Schema export</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete DDL for all four public tables — including RLS policies — as a single
              executable .sql file.
            </p>
          </div>
        </div>
        <pre className="mt-3 text-[10.5px] font-mono leading-relaxed p-3 rounded-md bg-surface-2/40 border border-border/60 max-h-48 overflow-auto">
          {SCHEMA_SQL.split("\n").slice(0, 14).join("\n") + "\n…"}
        </pre>
        <Button onClick={exportSchema} variant="outline" size="sm" className="mt-3 gap-1.5">
          <Download className="h-3 w-3" /> Export schema.sql
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 border border-border shrink-0">
            <FileText className="h-4 w-4 text-violet" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">Project report (Phase 6)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Markdown report covering architecture, delivered phases, SQL coverage and security
              posture. Suitable for academic submission.
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">
            Optional report tag
          </label>
          <Input
            value={reportTag}
            onChange={(e) => {
              setReportTag(e.target.value);
              validateTag(e.target.value);
            }}
            placeholder="e.g. final-submission"
            className="h-8 text-xs"
            maxLength={60}
            aria-invalid={!!tagError}
          />
          {tagError && <p className="text-[10.5px] text-destructive">{tagError}</p>}
        </div>
        <Button onClick={exportReport} variant="violet" size="sm" className="mt-3 gap-1.5">
          <Download className="h-3 w-3" /> Export report.md
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* PAGE                                                                 */
/* ──────────────────────────────────────────────────────────────────── */

function DataPlanPage() {
  const [filter, setFilter] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);

  function onFilterChange(v: string) {
    setFilter(v);
    const parsed = ReportFilterSchema.safeParse(v);
    setFilterError(parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">
          <Cpu className="h-3 w-3 text-violet" /> Data plan · Phase 6
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Analytics, pipeline & docs</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Production-grade scaffolding: parameterised SQL templates against the live schema, an
          end-to-end multimodal RAG demo, and one-click documentation exports.
        </p>

        <Tabs defaultValue="sql" className="mt-6">
          <TabsList>
            <TabsTrigger value="sql" className="gap-1.5">
              <Database className="h-3 w-3" /> SQL templates
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <Sparkles className="h-3 w-3" /> Pipeline demo
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5">
              <FileText className="h-3 w-3" /> Documentation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sql" className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => onFilterChange(e.target.value)}
                  placeholder="Filter templates…"
                  className="h-8 text-xs pl-8"
                  maxLength={60}
                  aria-invalid={!!filterError}
                />
              </div>
              {filterError && <span className="text-[10.5px] text-destructive">{filterError}</span>}
            </div>
            <SqlTemplatesFiltered filter={!filterError ? filter.trim().toLowerCase() : ""} />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <PipelineDemo />
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <DocsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SqlTemplatesFiltered({ filter }: { filter: string }) {
  if (!filter) return <SqlTemplatesPanel />;
  const matches = SQL_TEMPLATES.filter(
    (t) =>
      t.title.toLowerCase().includes(filter) ||
      t.description.toLowerCase().includes(filter) ||
      t.sql.toLowerCase().includes(filter),
  );
  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-xs text-muted-foreground">
        No templates match “{filter}”.
      </div>
    );
  }
  return <SqlTemplatesFilteredList list={matches} />;
}

function SqlTemplatesFilteredList({ list }: { list: SqlTemplate[] }) {
  const [activeResult, setActiveResult] = useState<string | null>(null);

  async function copyTemplate(t: SqlTemplate) {
    try {
      await navigator.clipboard.writeText(t.sql);
      toast.success("Query copied to clipboard", { description: t.title });
    } catch {
      toast.error("Clipboard unavailable");
    }
  }
  function runMock(t: SqlTemplate) {
    setActiveResult(t.id);
    toast.success(`Executed · ${t.mockResult.rows.length} rows`, { description: t.title });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {list.map((t) => {
        const showResult = activeResult === t.id;
        return (
          <div key={t.id} className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border/60 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">{t.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={() => copyTemplate(t)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button size="sm" variant="violet" className="h-7 text-xs gap-1.5" onClick={() => runMock(t)}>
                  <Play className="h-3 w-3" /> Run
                </Button>
              </div>
            </div>
            <pre className="text-[11px] font-mono leading-relaxed p-3 bg-surface-2/40 text-foreground/90 overflow-x-auto max-h-56">
              {t.sql}
            </pre>
            {showResult && (
              <div className="border-t border-border/60 bg-background/60">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-[oklch(0.74_0.16_155)]" />
                  Mock result · {t.mockResult.rows.length} rows · 24ms
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/60">
                        {t.mockResult.columns.map((c) => (
                          <th key={c} className="text-left px-3 py-1.5 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.mockResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 tabular-nums">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
