import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calcProgress, errMsg, type Plan, type Task } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/plans/")({
  head: () => ({ meta: [{ title: "My Plans — TaskBridge" }, { name: "description", content: "Your saved TaskBridge plans." }, { property: "og:title", content: "My Plans — TaskBridge" }, { property: "og:description", content: "Your saved TaskBridge plans." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MyPlans,
});

type PlanWithTasks = Plan & { plan_tasks: Pick<Task, "status">[] };

function MyPlans() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*, plan_tasks(status)").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as PlanWithTasks[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["plans"] }); },
    onError: (e) => toast.error(`Couldn't delete plan: ${errMsg(e)}`),
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">My Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you're working on.</p>
        </div>
        <Button asChild><Link to="/plans/new">Create New Plan</Link></Button>
      </div>

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : q.isError ? (
        <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Couldn't load your plans: {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()}>Retry</Button></AlertDescription></Alert>
      ) : q.data.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">No plans yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create your first plan from a work request.</p>
          <Button asChild className="mt-5"><Link to="/plans/new">Create New Plan</Link></Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data.map((p) => {
            const pr = calcProgress(p.plan_tasks);
            return (
              <article key={p.id} className="rounded-xl border bg-card p-5 flex flex-col">
                <h2 className="text-lg font-semibold leading-snug">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.goal}</p>
                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  {p.deadline && <div><dt className="inline">Deadline: </dt><dd className="inline text-foreground">{new Date(p.deadline + "T00:00").toLocaleDateString()}</dd></div>}
                  <div><dt className="inline">Tasks: </dt><dd className="inline text-foreground">{pr.done}/{pr.total} done</dd></div>
                </dl>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={pr.percent} className="h-2" aria-label="Progress" />
                  <span className="text-sm font-medium tabular-nums w-10 text-right">{pr.percent}%</span>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button asChild size="sm"><Link to="/plans/$id" params={{ id: p.id }}>Open Plan</Link></Button>
                  <ConfirmDelete title="Delete this plan?" description="The plan and all of its tasks will be permanently deleted." onConfirm={() => del.mutate(p.id)} disabled={del.isPending && del.variables === p.id} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
