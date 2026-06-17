import { Link } from "@tanstack/react-router";
import { Cpu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function AppShell({ children, sidebar }: { children: ReactNode; sidebar?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-12 items-center justify-between px-4">
          <Link to="/workspace" className="inline-flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)]">
              <Cpu className="h-3.5 w-3.5 text-violet-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">SpecMatch AI</span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Compatibility Workspace</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/workspace"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-xs text-foreground font-medium" }}
            >
              Workspace
            </Link>
            <Link
              to="/data-plan"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-xs text-foreground font-medium" }}
            >
              Data plan
            </Link>
            <Link
              to="/catalog"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Catalog
            </Link>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={signOut}>
              <LogOut className="h-3 w-3" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="flex-1 flex">
        {sidebar ? (
          <aside className="hidden lg:flex w-64 shrink-0 border-r border-border/60 bg-sidebar/40 flex-col">
            {sidebar}
          </aside>
        ) : null}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
