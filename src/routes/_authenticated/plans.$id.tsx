import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calcProgress, deliverablesList, errMsg, PRIORITIES, STATUSES, type Plan, type Task } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/plans/$id")({
  head: () => ({ meta: [{ title: "Plan — TaskBridge" }, { name: "description", content: "Plan details and tasks." }, { property: "og:title", content: "Plan — TaskBridge" }, { property: "og:description", content: "Plan details and tasks." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PlanPage,
});

function PlanPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => {
      const [p, t] = await Promise.all([
        supabase.from("plans").select("*").eq("id", id).maybeSingle(),
        supabase.from("plan_tasks").select("*").eq("plan_id", id).order("sort_order").order("created_at"),
      ]);
      if (p.error) throw p.error;
      if (t.error) throw t.error;
      return { plan: p.data, tasks: t.data };
    },
  });

  if (q.isPending) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (q.isError) return <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Couldn't load this plan: {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()}>Retry</Button></AlertDescription></Alert>;
  if (!q.data.plan) return (
    <div className="rounded-xl border bg-card p-10 text-center">
      <h1 className="text-lg font-semibold">Plan not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or it isn't yours.</p>
      <Button asChild className="mt-5"><Link to="/plans">Back to My Plans</Link></Button>
    </div>
  );
  return <PlanView plan={q.data.plan} tasks={q.data.tasks} />;
}

function PlanView({ plan, tasks }: { plan: Plan; tasks: Task[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const pr = calcProgress(tasks);
  const deliverables = deliverablesList(plan.deliverables);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["plan", plan.id] }); qc.invalidateQueries({ queryKey: ["plans"] }); };

  const delPlan = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("plans").delete().eq("id", plan.id); if (error) throw error; },
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["plans"] }); qc.removeQueries({ queryKey: ["plan", plan.id] }); navigate({ to: "/plans" }); },
    onError: (e) => toast.error(`Couldn't delete plan: ${errMsg(e)}`),
  });

  return (
    <div className="space-y-6">
      <Link to="/plans" className="text-sm text-muted-foreground hover:text-foreground">← My Plans</Link>
      {editing ? (
        <EditPlan plan={plan} onDone={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} />
      ) : (
        <section className="rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold">{plan.title}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit plan</Button>
              <ConfirmDelete title="Delete this plan?" description="The plan and all of its tasks will be permanently deleted." onConfirm={() => delPlan.mutate()} disabled={delPlan.isPending} label="Delete plan" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 max-w-md">
            <Progress value={pr.percent} className="h-2" aria-label="Overall progress" />
            <span className="text-sm font-medium tabular-nums">{pr.percent}%</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{pr.done}/{pr.total} done</span>
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Info label="Task description"><p className="whitespace-pre-wrap">{plan.description}</p></Info>
            <Info label="Goal"><p className="whitespace-pre-wrap">{plan.goal}</p></Info>
            <Info label="Desired deliverables">
              {deliverables.length ? <ul className="list-disc pl-5 space-y-0.5">{deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul> : <p className="text-muted-foreground">None added yet.</p>}
            </Info>
            <Info label="Next step"><p className={plan.next_step ? "" : "text-muted-foreground"}>{plan.next_step || "Not set."}</p></Info>
            <Info label="Deadline"><p className={plan.deadline ? "" : "text-muted-foreground"}>{plan.deadline ? new Date(plan.deadline + "T00:00").toLocaleDateString() : "No deadline"}</p></Info>
          </dl>
        </section>
      )}
      <Tasks planId={plan.id} userId={plan.user_id} tasks={tasks} refresh={refresh} />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</dt><dd className="text-sm">{children}</dd></div>;
}

function EditPlan({ plan, onDone, onCancel }: { plan: Plan; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    title: plan.title, description: plan.description, goal: plan.goal, deadline: plan.deadline ?? "",
    next_step: plan.next_step ?? "", deliverables: deliverablesList(plan.deliverables).join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.title.trim() || !f.description.trim() || !f.goal.trim()) return setError("Title, task description and goal are required.");
    setBusy(true); setError(null);
    const { error } = await supabase.from("plans").update({
      title: f.title.trim(), description: f.description.trim(), goal: f.goal.trim(), deadline: f.deadline || null,
      next_step: f.next_step.trim() || null, deliverables: f.deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
    }).eq("id", plan.id);
    setBusy(false);
    if (error) return setError(`Couldn't save changes: ${errMsg(error)}`);
    toast.success("Plan updated");
    onDone();
  }
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  return (
    <form onSubmit={save} className="rounded-xl border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Edit plan</h2>
      <div className="space-y-1.5"><Label htmlFor="e-title">Plan Title *</Label><Input id="e-title" {...bind("title")} /></div>
      <div className="space-y-1.5"><Label htmlFor="e-desc">Task Description *</Label><Textarea id="e-desc" rows={4} {...bind("description")} /></div>
      <div className="space-y-1.5"><Label htmlFor="e-goal">Goal *</Label><Textarea id="e-goal" rows={2} {...bind("goal")} /></div>
      <div className="space-y-1.5"><Label htmlFor="e-deliv">Desired deliverables (one per line)</Label><Textarea id="e-deliv" rows={3} {...bind("deliverables")} /></div>
      <div className="space-y-1.5"><Label htmlFor="e-next">Next step</Label><Input id="e-next" {...bind("next_step")} /></div>
      <div className="space-y-1.5"><Label htmlFor="e-dl">Deadline</Label><Input id="e-dl" type="date" className="w-auto" {...bind("deadline")} /></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button><Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button></div>
    </form>
  );
}

function Tasks({ planId, userId, tasks, refresh }: { planId: string; userId: string; tasks: Task[]; refresh: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("Medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setError("Task title is required.");
    setBusy(true); setError(null);
    const sort_order = tasks.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1;
    const { error } = await supabase.from("plan_tasks").insert({ plan_id: planId, user_id: userId, title: title.trim(), description: description.trim() || null, priority, sort_order });
    setBusy(false);
    if (error) return setError(`Couldn't add task: ${errMsg(error)}`);
    setTitle(""); setDescription(""); setPriority("Medium");
    refresh();
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-xl font-semibold">Tasks</h2>
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No tasks yet. Add the first one below.</p>
      ) : (
        <ul className="mt-4 divide-y">{tasks.map((t) => <TaskRow key={t.id} task={t} refresh={refresh} />)}</ul>
      )}
      <form onSubmit={add} className="mt-6 rounded-lg bg-muted p-4 space-y-3">
        <h3 className="text-sm font-semibold">Add a task</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div className="space-y-1.5"><Label htmlFor="t-title">Title *</Label><Input id="t-title" className="bg-card" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="t-prio">Priority</Label><PrioritySelect id="t-prio" value={priority} onChange={setPriority} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="t-desc">Description (optional)</Label><Textarea id="t-desc" rows={2} className="bg-card" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add task"}</Button>
      </form>
    </section>
  );
}

function PrioritySelect({ id, value, onChange, disabled }: { id?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={!!disabled}>
      <SelectTrigger id={id} className="bg-card" aria-label="Priority"><SelectValue /></SelectTrigger>
      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const prioDot: Record<string, string> = { High: "bg-destructive", Medium: "bg-warning", Low: "bg-success" };

function TaskRow({ task, refresh }: { task: Task; refresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [busy, setBusy] = useState(false);

  async function patch(values: Partial<Pick<Task, "title" | "description" | "status" | "priority">>, okMsg?: string) {
    if (busy) return false;
    setBusy(true);
    const { error } = await supabase.from("plan_tasks").update(values).eq("id", task.id);
    setBusy(false);
    if (error) { toast.error(`Couldn't update task: ${errMsg(error)}`); return false; }
    if (okMsg) toast.success(okMsg);
    refresh();
    return true;
  }
  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("plan_tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) { toast.error(`Couldn't delete task: ${errMsg(error)}`); return; }
    toast.success("Task deleted");
    refresh();
  }

  if (editing) return (
    <li className="py-4 space-y-2">
      <Label htmlFor={`et-${task.id}`} className="sr-only">Task title</Label>
      <Input id={`et-${task.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label htmlFor={`ed-${task.id}`} className="sr-only">Task description</Label>
      <Textarea id={`ed-${task.id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !title.trim()} onClick={async () => { if (await patch({ title: title.trim(), description: description.trim() || null }, "Task updated")) setEditing(false); }}>{busy ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setTitle(task.title); setDescription(task.description ?? ""); }}>Cancel</Button>
      </div>
    </li>
  );

  const done = task.status === "Done";
  return (
    <li className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${prioDot[task.priority]}`} />
          <p className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        </div>
        {task.description && <p className="mt-0.5 pl-4 text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-4 sm:pl-0">
        <div className="w-32"><PrioritySelect value={task.priority} onChange={(v) => patch({ priority: v })} disabled={busy} /></div>
        <Select value={task.status} onValueChange={(v) => patch({ status: v })} disabled={busy}>
          <SelectTrigger className="w-36 bg-card" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>
        <ConfirmDelete title="Delete this task?" description={`"${task.title}" will be permanently deleted.`} onConfirm={remove} disabled={busy} />
      </div>
    </li>
  );
}
