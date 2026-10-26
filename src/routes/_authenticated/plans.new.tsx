import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/plans/new")({
  head: () => ({ meta: [{ title: "Create Plan — TaskBridge" }, { name: "description", content: "Create a new work plan." }, { property: "og:title", content: "Create Plan — TaskBridge" }, { property: "og:description", content: "Create a new work plan." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewPlan,
});

function NewPlan() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", description: "", goal: "", deadline: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (!f.title.trim()) errs["title"] = "Plan title is required.";
    if (!f.description.trim()) errs["description"] = "Task description is required.";
    if (!f.goal.trim()) errs["goal"] = "Desired outcome is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.from("plans").insert({
      user_id: user.id, title: f.title.trim(), description: f.description.trim(), goal: f.goal.trim(), deadline: f.deadline || null,
    }).select("id").single();
    setBusy(false);
    if (error) return setError(`Couldn't create plan: ${errMsg(error)}`);
    qc.invalidateQueries({ queryKey: ["plans"] });
    toast.success("Plan created. Now add your tasks.");
    navigate({ to: "/plans/$id", params: { id: data.id } });
  }

  const field = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }), "aria-invalid": !!errors[k] });

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Create Plan</h1>
      <p className="text-sm text-muted-foreground mt-1">Describe the request. You'll add tasks next.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5 rounded-xl border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="title">Plan Title *</Label>
          <Input id="title" placeholder="e.g. Website redesign for Acme" {...field("title")} />
          {errors["title"] && <p className="text-xs text-destructive">{errors["title"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Task Description *</Label>
          <Textarea id="description" rows={5} placeholder="Paste or summarize the request you received." {...field("description")} />
          {errors["description"] && <p className="text-xs text-destructive">{errors["description"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal">Desired Outcome *</Label>
          <Textarea id="goal" rows={3} placeholder="What does success look like?" {...field("goal")} />
          {errors["goal"] && <p className="text-xs text-destructive">{errors["goal"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Deadline (optional)</Label>
          <Input id="deadline" type="date" className="w-auto" {...field("deadline")} />
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create Plan"}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/plans" })}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
