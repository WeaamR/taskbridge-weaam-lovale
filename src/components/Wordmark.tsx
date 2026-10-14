import { Link } from "@tanstack/react-router";

export function Wordmark({ to = "/" }: { to?: "/" | "/plans" }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">TB</span>
      TaskBridge
    </Link>
  );
}
