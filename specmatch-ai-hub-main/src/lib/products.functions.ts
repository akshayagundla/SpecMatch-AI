import { createServerFn } from "@tanstack/react-start";

export type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specs: any;
  profile_text: string;
};

export const listProducts = createServerFn({ method: "GET" }).handler(async (): Promise<ProductRow[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand, category, price_cents, image_url, specs, profile_text")
    .order("price_cents", { ascending: false });
  if (error) {
    console.error("[products] list failed", error);
    throw new Error("Failed to load products");
  }
  return (data ?? []) as ProductRow[];
});
