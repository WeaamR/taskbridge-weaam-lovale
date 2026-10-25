import { CONFIRMATION_COOLDOWN_SECONDS, type SignupAction, type SignupResult } from "./signup";

type AuthError = { status?: number; code?: string; message: string } | null;
type Dependencies = {
  check: (email: string, ip: string, action: SignupAction) => Promise<{ status: string; retryAfter?: number }>;
  register: (email: string, password: string, redirect: string) => Promise<{ error: AuthError; user: { identities?: unknown[]; email_confirmed_at?: string } | null }>;
  resend: (email: string, redirect: string) => Promise<{ error: AuthError }>;
  reset: (email: string, redirect: string) => Promise<{ error: AuthError }>;
};

function failure(error: AuthError): SignupResult {
  if (error?.status === 429) return { status: "limited", retryAfter: 60, message: "Too many requests. Please wait before trying again." };
  return { status: "error", message: "We couldn’t complete your request. Please try again later." };
}

export async function processSignupRequest(
  input: { email: string; password?: string; action: SignupAction; ip: string; origin: string },
  dependencies: Dependencies,
): Promise<SignupResult> {
  try {
    const account = await dependencies.check(input.email, input.ip, input.action);
    if (account.status === "limited") return { status: "limited", retryAfter: account.retryAfter ?? 60 };
    if (!["new", "confirmed", "unconfirmed"].includes(account.status)) return failure(null);
    if (input.action === "reset") {
      const { error } = await dependencies.reset(input.email, `${input.origin}/reset-password`);
      return error ? failure(error) : { status: "reset", retryAfter: 60 };
    }
    if (account.status === "confirmed") return { status: "confirmed" };
    if (account.status === "unconfirmed") {
      if (input.action !== "resend") return { status: "unconfirmed" };
      const { error } = await dependencies.resend(input.email, `${input.origin}/auth`);
      return error ? { ...failure(error), retryAfter: 60 } : { status: "resent", retryAfter: CONFIRMATION_COOLDOWN_SECONDS };
    }
    if (input.action === "resend") return { status: "error", message: "Please create an account first." };
    const { error, user } = await dependencies.register(input.email, input.password ?? "", `${input.origin}/auth`);
    if (error) return failure(error);
    if (!user) return failure(null);
    // Supabase obscures duplicate registration with an empty identities list.
    // A concurrent registration may happen between our lookup and signUp.
    if (user.identities?.length === 0) {
      const latest = await dependencies.check(input.email, input.ip, "signup");
      if (latest.status === "confirmed" || latest.status === "unconfirmed") return { status: latest.status };
      return latest.status === "limited" ? { status: "limited", retryAfter: latest.retryAfter } : failure(null);
    }
    return { status: "created", requiresConfirmation: !user.email_confirmed_at, retryAfter: 60 };
  } catch {
    return { status: "error", message: "Unable to connect. Please try again. No confirmation is available yet." };
  }
}