import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestSignup } from "@/lib/signup.functions";
import { createSubmissionGate, normalizeEmail, type SignupAction, type SignupResult } from "@/lib/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AuthForm({ initialMode, onSignedIn }: { initialMode: "signin" | "signup"; onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<"confirmed" | "unconfirmed" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const gate = useRef(createSubmissionGate());
  const cooldowns = useRef(new Map<string, number>());
  const request = useServerFn(requestSignup);
  const normalized = normalizeEmail(email);

  useEffect(() => {
    const tick = () => setCooldown(Math.max(0, Math.ceil(((cooldowns.current.get(normalized) ?? 0) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [normalized]);

  function changeMode(next: "signin" | "signup" | "forgot") {
    setMode(next); setError(null); setNotice(null); setAccount(null);
  }

  function showResult(result: SignupResult) {
    if (result.retryAfter) {
      cooldowns.current.set(normalized, Date.now() + result.retryAfter * 1000);
      setCooldown(result.retryAfter);
    }
    if (result.status === "error" || result.status === "limited") {
      setError(result.message ?? "Too many requests. Please wait before trying again.");
      return;
    }
    if (result.status === "confirmed") { setAccount("confirmed"); setNotice("This email is already registered. Please sign in."); }
    if (result.status === "unconfirmed") { setAccount("unconfirmed"); setNotice("Your account is awaiting email confirmation."); }
    if (result.status === "resent" || result.status === "created") {
      if (result.status === "created" && result.requiresConfirmation === false) {
        setAccount("confirmed"); setNotice("Your account is ready. Please sign in.");
      } else {
        setAccount("unconfirmed");
        setNotice("Confirmation email requested successfully. Check your inbox and spam folder, then follow the confirmation link before signing in.");
      }
    }
    if (result.status === "reset") setNotice("If an account exists for this email, a password reset was requested. Check your inbox and spam folder for a reset link.");
  }

  async function send(action: SignupAction) {
    if (!gate.current.enter()) return;
    setBusy(true); setError(null);
    try {
      showResult(await request({ data: { email: normalized, password: action === "signup" ? password : undefined, action } }));
    } catch {
      setError("Unable to connect. Please try again. No confirmation is available yet.");
    } finally { gate.current.leave(); setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" || mode === "forgot") {
      if (cooldown > 0 || (mode === "signup" && account)) return;
      setNotice(null);
      await send(mode === "forgot" ? "reset" : "signup");
      return;
    }
    if (!gate.current.enter()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (authError) throw authError;
      onSignedIn();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in. Please try again."); }
    finally { gate.current.leave(); setBusy(false); }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Start turning requests into plans." : mode === "forgot" ? "Request a password reset link." : "Sign in to see your plans."}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={(e) => { setEmail(e.target.value); setAccount(null); setNotice(null); setError(null); }} onBlur={() => setEmail(normalizeEmail(email))} />
        </div>
        {mode !== "forgot" && <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} maxLength={128} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}
        {mode === "signup" && account === "confirmed" ? <Button type="button" className="w-full" disabled={busy} onClick={() => changeMode("signin")}>Sign In</Button> : mode === "signup" && account === "unconfirmed" ? <Button type="button" className="w-full" disabled={busy || cooldown > 0} onClick={() => send("resend")}>
          {busy ? "Please wait…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend confirmation email"}
        </Button> : <Button type="submit" className="w-full" disabled={busy || (mode !== "signin" && cooldown > 0)}>
          {busy ? "Please wait…" : mode !== "signin" && cooldown > 0 ? `Try again in ${cooldown}s` : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
        </Button>}
      </form>
      {(mode === "signin" || account === "confirmed") && <Button type="button" variant="link" className="mt-2 h-auto p-0 text-sm" disabled={busy} onClick={() => changeMode("forgot")}>Forgot password?</Button>}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remember your password?" : "New to TaskBridge?"}{" "}
        <Button type="button" variant="link" className="h-auto p-0 font-medium" disabled={busy} onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </Button>
      </p>
    </div>
  );
}