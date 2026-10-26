import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wordmark } from "@/components/Wordmark";
import { createSubmissionGate } from "@/lib/signup";
import { clearRecovery, INVALID_RECOVERY_MESSAGE, validateRecoveryLink } from "@/lib/recovery";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password — TaskBridge" },
    { name: "description", content: "Choose a new password for your TaskBridge account." },
    { property: "og:title", content: "Reset password — TaskBridge" },
    { property: "og:description", content: "Choose a new password for your TaskBridge account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(createSubmissionGate());
  useEffect(() => {
    let active = true;
    validateRecoveryLink(window.location.href, supabase.auth)
      .then(() => { if (active) setReady(true); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to verify your reset link. Please try again."); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !gate.current.enter()) return;
    if (password !== confirm) { gate.current.leave(); setError("Passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.status === 401 || error.status === 403 || error.code === "session_not_found" || error.code === "refresh_token_not_found") {
          setReady(false); clearRecovery(); setError(INVALID_RECOVERY_MESSAGE); return;
        }
        throw error;
      }
      clearRecovery();
      setDone(true);
    } catch { setError("We couldn’t update your password. Please try again."); }
    finally { gate.current.leave(); setBusy(false); }
  }
  return <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
    <div className="mb-8"><Wordmark /></div>
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {done ? <p className="mt-4 text-sm">Your password has been updated.</p> : <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} disabled={!ready || busy} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} disabled={!ready || busy} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="w-full" disabled={!ready || busy}>{busy ? "Please wait…" : "Update password"}</Button>
      </form>}
      {!ready && error && <Button asChild variant="link" className="mt-3 h-auto p-0"><Link to="/auth" search={{ mode: "signin" }}>Request a new reset link</Link></Button>}
      <Button asChild variant="link" className="mt-4 h-auto p-0"><Link to="/auth" search={{ mode: "signin" }}>Back to sign in</Link></Button>
    </div>
  </div>;
}