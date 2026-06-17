/**
 * SpecMatch AI — Multimodal RAG Compatibility Agent
 *
 * Pipeline:
 *  1. Optional vision step: extract structured hardware spec JSON from uploaded image.
 *  2. Build query embedding from user text + extracted specs.
 *  3. Lazy-embed product catalog (cached as JSONB column).
 *  4. Cosine similarity → top-3 candidate accessories/devices.
 *  5. LLM with strict "Expert Electronics Solutions Architect" system prompt
 *     produces grounded markdown answer + per-product compatibility scores.
 *  6. Persist user + assistant messages on the session.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const ChatInput = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  imageDataUrl: z.string().startsWith("data:image/").max(8_000_000).optional(),
});

export type ChatRecommendation = {
  product_id: string;
  name: string;
  brand: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  score: number;
  reason: string;
};

export type ChatResponse = {
  sessionId: string;
  assistantMessageId: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedSpecs: any;
  recommendations: ChatRecommendation[];
};

const SYSTEM_PROMPT = `You are SpecMatch AI — an Expert Electronics Solutions Architect.

Your job is to evaluate hardware compatibility between a user's device(s) and a curated catalog
of candidate products. You speak with precision: cite specific hardware constraints by name
(e.g. "Thunderbolt 4 supports DisplayPort 1.4 → 4K @ 144Hz with DSC", "watchOS pairs only with
iOS — Galaxy Watch requires Android 11+", "LDAC over Bluetooth 5.3 needs Android; iPhone falls
back to AAC", "USB-C 3.2 with DP Alt Mode required for external monitor").

You receive:
- The user's question.
- (Optional) An extracted JSON profile from an image of the user's device/spec sheet.
- A short list of candidate products (retrieved via semantic search) with full specs.

You MUST:
1. Open with one tight sentence answering the user's question directly.
2. Justify with concrete hardware constraints — name protocols, port versions, OS requirements.
3. For each candidate product, decide if it is genuinely compatible. Be willing to reject items.
4. Note ecosystem locks (Apple ↔ iOS, Galaxy Watch ↔ Android, etc.).
5. End with a short "Bottom line" recommendation.

Keep the prose tight and technical — no marketing fluff, no emojis, no apologies.`;

const RECS_INSTRUCTION = `After your prose answer, output a single fenced JSON block (\`\`\`json ... \`\`\`)
with this exact shape and nothing else:
{"recommendations":[{"product_id":"<uuid>","score":<0-100 integer>,"reason":"<≤140 chars technical reason>"}]}
Include only candidates you genuinely recommend. Score reflects compatibility confidence (98 = perfect, 60 = workable with caveats, <40 = incompatible — omit those).`;

function extractRecsFromMarkdown(md: string): Array<{ product_id: string; score: number; reason: string }> {
  const match = md.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed?.recommendations)) return [];
    return parsed.recommendations
      .filter((r: any) => typeof r?.product_id === "string" && typeof r?.score === "number")
      .map((r: any) => ({
        product_id: r.product_id,
        score: Math.max(0, Math.min(100, Math.round(r.score))),
        reason: String(r.reason ?? "").slice(0, 200),
      }));
  } catch {
    return [];
  }
}

function stripJsonBlock(md: string): string {
  return md.replace(/```json\s*[\s\S]*?```/i, "").trim();
}

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ context, data }): Promise<ChatResponse> => {
    const geminiKey = process.env.GEMINI_API_KEY;

    console.log("GEMINI KEY EXISTS:", !!geminiKey);
    console.log("KEY LENGTH:", geminiKey?.length);

    if (!geminiKey) throw new Error("Missing GEMINI_API_KEY");
   const chatModel = google("gemini-2.5-flash");

    console.log("[chat] start", { userId: context.userId, hasImage: !!data.imageDataUrl });

    const { embedText, cosineSimilarity } =
  await import("@/lib/ai-gateway.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    
    // ──────────────────────────────────────────────────────────────
    // 1. Ensure session
    // ──────────────────────────────────────────────────────────────
    let sessionId = data.sessionId;
    if (!sessionId) {
      const { data: s, error } = await context.supabase
        .from("sessions")
        .insert({ user_id: context.userId, title: data.message.slice(0, 60) })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sessionId = s.id;
    }

    // ──────────────────────────────────────────────────────────────
    // 2. Optional vision extraction
    // ──────────────────────────────────────────────────────────────
    let extractedSpecs: Record<string, unknown> | null = null;
    if (data.imageDataUrl) {
      try {
        const visionResult = await generateText({
          model: chatModel,
          messages: [
            {
              role: "system",
              content:
                "Extract a structured hardware profile from this image. Return STRICT JSON only " +
                '(no prose, no markdown fences) with fields: {"device":"","brand":"","model":"","os":"","processor":"","ram":"","storage":"","display":"","ports":[],"wireless":[],"ecosystem":"","notes":""}. ' +
                "Use empty string for unknown fields. If the image does not show a device or spec sheet, return {\"error\":\"not a device\"}.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract the hardware profile." },
                { type: "image", image: data.imageDataUrl },
              ],
            },
          ],
        });
        const raw = visionResult.text.replace(/```json|```/g, "").trim();
        extractedSpecs = JSON.parse(raw);
        console.log("[chat] vision ok", extractedSpecs);
      } catch (err) {
        console.error("[chat] vision failed", err);
        extractedSpecs = { error: "Could not extract spec profile from image" };
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 3. Persist user message
    // ──────────────────────────────────────────────────────────────
    const { data: userMsg, error: userMsgErr } = await context.supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: context.userId,
        role: "user",
        content: data.message,
        image_url: data.imageDataUrl ? "(attached image)" : null,
        extracted_specs: extractedSpecs as never,
      })
      .select("id")
      .single();
    if (userMsgErr) throw new Error(userMsgErr.message);

    // ──────────────────────────────────────────────────────────────
    // 4. Load products + lazy embed missing ones
    // ──────────────────────────────────────────────────────────────
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, brand, category, price_cents, image_url, specs, profile_text, embedding");
    if (prodErr) throw new Error(prodErr.message);
    const productList = products ?? [];

    const missing = productList.filter((p) => !p.embedding);
    if (missing.length > 0) {
      console.log("[chat] embedding", missing.length, "products");
      const vectors = await embedText(
        geminiKey,
        missing.map((m) => m.profile_text),
      );
      await Promise.all(
        missing.map((m, i) =>
          supabaseAdmin.from("products").update({ embedding: vectors[i] }).eq("id", m.id),
        ),
      );
      missing.forEach((m, i) => {
        (m as any).embedding = vectors[i];
      });
    }

    // ──────────────────────────────────────────────────────────────
    // 5. Embed query, retrieve top-5 candidates
    // ──────────────────────────────────────────────────────────────
    const queryText = [
      data.message,
      extractedSpecs && !("error" in extractedSpecs)
        ? `User device profile: ${JSON.stringify(extractedSpecs)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const [queryVec] = await embedText(geminiKey, queryText);
    const ranked = productList
      .map((p) => ({
        product: p,
        sim: cosineSimilarity(queryVec, (p.embedding as number[]) ?? []),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5);

    console.log(
      "[chat] candidates",
      ranked.map((r) => ({ name: r.product.name, sim: r.sim.toFixed(3) })),
    );

    // ──────────────────────────────────────────────────────────────
    // 6. LLM call with grounded context
    // ──────────────────────────────────────────────────────────────
    const candidateBlock = ranked
      .map(
        (r, i) =>
          `### Candidate ${i + 1} — id: ${r.product.id}\n` +
          `${r.product.brand} ${r.product.name} (${r.product.category}) — $${(r.product.price_cents / 100).toFixed(0)}\n` +
          `Specs: ${JSON.stringify(r.product.specs)}\n` +
          `Retrieval similarity: ${r.sim.toFixed(3)}`,
      )
      .join("\n\n");

    const userBlock =
      `User question: ${data.message}\n\n` +
      (extractedSpecs && !("error" in extractedSpecs)
        ? `Extracted device profile from uploaded image:\n${JSON.stringify(extractedSpecs, null, 2)}\n\n`
        : "") +
      `Candidate products (top-${ranked.length} from semantic retrieval):\n\n${candidateBlock}\n\n` +
      RECS_INSTRUCTION;

    let answerText: string;
    try {
      const result = await generateText({
        model: chatModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userBlock },
        ],
        maxRetries: 0,
      });
      answerText = result.text;
    } catch (err: any) {
  console.error("FULL ERROR:");
  console.error(JSON.stringify(err, null, 2));
  throw err;
}

    const recsRaw = extractRecsFromMarkdown(answerText);
    const prose = stripJsonBlock(answerText);

    const recommendations: ChatRecommendation[] = recsRaw
      .map((r) => {
        const p = productList.find((pp) => pp.id === r.product_id);
        if (!p) return null;
        return {
          product_id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          price_cents: p.price_cents,
          image_url: p.image_url,
          score: r.score,
          reason: r.reason,
        } satisfies ChatRecommendation;
      })
      .filter((x): x is ChatRecommendation => !!x)
      .sort((a, b) => b.score - a.score);

    // ──────────────────────────────────────────────────────────────
    // 7. Persist assistant message + bump session
    // ──────────────────────────────────────────────────────────────
    const { data: assistantMsg, error: aMsgErr } = await context.supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: context.userId,
        role: "assistant",
        content: prose,
        recommendations,
      })
      .select("id")
      .single();
    if (aMsgErr) throw new Error(aMsgErr.message);

    await context.supabase
      .from("sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", sessionId);

    console.log("[chat] done", { sessionId, recs: recommendations.length });

    return {
      sessionId,
      assistantMessageId: assistantMsg.id,
      content: prose,
      extractedSpecs,
      recommendations,
    };
  });
