import { describe, expect, it } from "vitest";
import { calcProgress } from "@/lib/plans";

describe("plan progress", () => {
  it("is 0% when a plan has no tasks", () => {
    expect(calcProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
  });
  it("is completed tasks divided by total tasks", () => {
    expect(calcProgress([{ status: "Done" }, { status: "To Do" }, { status: "In Progress" }, { status: "Done" }]).percent).toBe(50);
  });
});
