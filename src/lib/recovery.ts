const RECOVERY_KEY = "taskbridge-password-recovery";
const RECOVERY_LIFETIME_MS = 60 * 60 * 1000;
export const INVALID_RECOVERY_MESSAGE = "This reset link is invalid or expired. Please request a new password reset link.";

export function rememberRecovery(userId: string) {
  window.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ userId, expiresAt: Date.now() + RECOVERY_LIFETIME_MS }));
}
export function clearRecovery() { window.sessionStorage.removeItem(RECOVERY_KEY); }
export function isRecoverySession(userId: string) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(RECOVERY_KEY) ?? "null");
    return value?.userId === userId && typeof value?.expiresAt === "number" && value.expiresAt > Date.now();
  } catch { return false; }
}

type RecoveryAuth = {
  initialize: () => Promise<{ error: unknown }>;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};
export async function validateRecoveryLink(url: string, auth: RecoveryAuth) {
  const current = new URL(url);
  const hash = new URLSearchParams(current.hash.slice(1));
  if (hash.has("error") || hash.has("error_code") || current.searchParams.has("error") || current.searchParams.has("error_code")) {
    clearRecovery(); throw new Error(INVALID_RECOVERY_MESSAGE);
  }
  const incomingRecovery = hash.get("type") === "recovery";
  const { error: initializationError } = await auth.initialize();
  if (initializationError) { clearRecovery(); throw new Error(INVALID_RECOVERY_MESSAGE); }
  const { data, error } = await auth.getUser();
  if (error || !data.user || (!incomingRecovery && !isRecoverySession(data.user.id))) {
    clearRecovery(); throw new Error(INVALID_RECOVERY_MESSAGE);
  }
  if (incomingRecovery) rememberRecovery(data.user.id);
}