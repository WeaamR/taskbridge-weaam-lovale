import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaskBridge — Turn unclear requests into clear plans" },
      { name: "description", content: "TaskBridge helps freelancers break work requests into tasks, priorities and deliverables, then track progress." },
      { property: "og:title", content: "TaskBridge — Turn unclear requests into clear plans" },
      { property: "og:description", content: "Break work requests into tasks, priorities and deliverables. Track progress in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5 flex items-center justify-between">
        <Wordmark />
        <Button asChild variant="ghost" size="sm"><Link to="/auth" search={{ mode: "signin" }}>Sign In</Link></Button>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 flex flex-col justify-center py-16">
        <p className="text-sm font-medium text-primary mb-4">For freelancers and early-career professionals</p>
        <h1 className="text-4xl sm:text-6xl font-semibold max-w-3xl leading-[1.05]">
          Turn unclear requests into clear, actionable plans.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Capture what was asked, define the outcome, break it into prioritized tasks, and watch your progress as you deliver.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Get Started</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ mode: "signin" }}>Sign In</Link></Button>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            ["Clarify", "Write down the request and the outcome it should produce."],
            ["Break down", "Split the work into tasks with priority and status."],
            ["Deliver", "Track completed tasks and always know your next step."],
          ].map(([t, d], i) => (
            <div key={t} className="rounded-xl border bg-card p-5">
              <span className="text-xs font-semibold text-muted-foreground">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-5 py-6 text-xs text-muted-foreground">© TaskBridge</footer>
    </div>
  );
}
