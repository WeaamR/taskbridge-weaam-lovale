export type SignupAction = "signup" | "resend" | "reset";
export type SignupResult = {
  status: "confirmed" | "unconfirmed" | "created" | "resent" | "reset" | "limited" | "error";
  retryAfter?: number;
  message?: string;
  requiresConfirmation?: boolean;
};
export const CONFIRMATION_COOLDOWN_SECONDS = 60;
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }

export function createSubmissionGate() {
  let active = false;
  return {
    enter() { if (active) return false; active = true; return true; },
    leave() { active = false; },
  };
}