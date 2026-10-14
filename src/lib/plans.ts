import type { Database } from "@/integrations/supabase/types";

export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Task = Database["public"]["Tables"]["plan_tasks"]["Row"];

export const STATUSES = ["To Do", "In Progress", "Done"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;

/** Progress = done tasks / total tasks, rounded. 0% when there are no tasks. */
export function calcProgress(tasks: Pick<Task, "status">[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function deliverablesList(d: unknown): string[] {
  return Array.isArray(d) ? d.filter((x): x is string => typeof x === "string") : [];
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong.";
}
