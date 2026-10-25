import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { AuthForm } from "@/components/AuthForm";

type Mode = "signin" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode | undefined } => ({
    mode: s["mode"] === "signup" ? "signup" : s["mode"] === "signin" ? "signin" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — TaskBridge" },
      { name: "description", content: "Sign in or create a TaskBridge account." },
      { property: "og:title", content: "Sign in — TaskBridge" },
      { property: "og:description", content: "Sign in or create a TaskBridge account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/plans", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="mb-8"><Wordmark /></div>
      <AuthForm initialMode={initial ?? "signin"} onSignedIn={() => navigate({ to: "/plans" })} />
    </div>
  );
}
