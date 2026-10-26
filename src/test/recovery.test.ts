import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRecovery, INVALID_RECOVERY_MESSAGE, rememberRecovery, validateRecoveryLink } from "@/lib/recovery";
const user = { id: "test-user" };
function auth() { return { initialize: vi.fn().mockResolvedValue({ error: null }), getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }; }
afterEach(() => { clearRecovery(); vi.useRealTimers(); });
describe("Password recovery session", () => {
  it("accepts a validated incoming recovery session", async () => {
    const client = auth();
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password#type=recovery", client)).resolves.toBeUndefined();
    expect(client.initialize).toHaveBeenCalledOnce(); expect(client.getUser).toHaveBeenCalledOnce();
  });
  it("accepts recovery after Supabase consumes the URL hash", async () => {
    rememberRecovery(user.id);
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password", auth())).resolves.toBeUndefined();
  });
  it("rejects an ordinary signed-in session without recovery intent", async () => {
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password", auth())).rejects.toThrow(INVALID_RECOVERY_MESSAGE);
  });
  it("rejects an expired emailed link even if another valid session exists", async () => {
    rememberRecovery(user.id); const client = auth();
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password#error=access_denied&error_code=otp_expired", client)).rejects.toThrow(INVALID_RECOVERY_MESSAGE);
    expect(client.getUser).not.toHaveBeenCalled();
  });
  it("rejects malformed or invalid recovery tokens", async () => {
    const client = auth(); client.initialize.mockResolvedValue({ error: new Error("Invalid token") });
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password#type=recovery", client)).rejects.toThrow(INVALID_RECOVERY_MESSAGE);
  });
  it("rejects an expired stored recovery intent", async () => {
    vi.useFakeTimers(); rememberRecovery(user.id); vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password", auth())).rejects.toThrow(INVALID_RECOVERY_MESSAGE);
  });
  it("never trusts recovery intent belonging to another user", async () => {
    rememberRecovery("another-user");
    await expect(validateRecoveryLink("https://taskbridge-weaam.lovable.app/reset-password", auth())).rejects.toThrow(INVALID_RECOVERY_MESSAGE);
  });
});