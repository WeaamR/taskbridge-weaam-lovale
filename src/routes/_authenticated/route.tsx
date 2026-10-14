import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  const nav = "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted";
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-2">
          <Wordmark to="/plans" />
          <nav className="ml-4 hidden sm:flex gap-1">
            <Link to="/plans" className={nav} activeOptions={{ exact: true }} activeProps={{ className: "text-foreground bg-muted" }}>My Plans</Link>
            <Link to="/plans/new" className={nav} activeProps={{ className: "text-foreground bg-muted" }}>Create Plan</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-48">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Log out</Button>
          </div>
        </div>
        <nav className="sm:hidden mx-auto max-w-5xl px-4 pb-2 flex gap-1">
          <Link to="/plans" className={nav} activeOptions={{ exact: true }} activeProps={{ className: "text-foreground bg-muted" }}>My Plans</Link>
          <Link to="/plans/new" className={nav} activeProps={{ className: "text-foreground bg-muted" }}>Create Plan</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8"><Outlet /></main>
    </div>
  );
}
