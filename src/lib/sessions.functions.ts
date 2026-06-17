import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
};

export type MessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extracted_specs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendations: any;
  created_at: string;
};

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionRow[]> => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, title, created_at, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as SessionRow[];
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(120).optional() }).parse(d))
  .handler(async ({ context, data }): Promise<SessionRow> => {
    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({ user_id: context.userId, title: data.title ?? "New analysis" })
      .select("id, title, created_at, last_message_at")
      .single();
    if (error) throw new Error(error.message);
    return row as SessionRow;
  });

export const getSessionMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<MessageRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, session_id, role, content, image_url, extracted_specs, recommendations, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as MessageRow[];
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("sessions").delete().eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
