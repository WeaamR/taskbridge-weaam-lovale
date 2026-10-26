import { describe, expect, it, vi } from "vitest";
import { processSignupRequest } from "@/lib/signup-service.server";
import { CONFIRMATION_COOLDOWN_SECONDS, createSubmissionGate, normalizeEmail } from "@/lib/signup";

const input = { email: "person@example.com", password: "testing-password", action: "signup" as const, ip: "test", origin: "https://taskbridge.example" };
function deps(status: string) {
  return {
    check: vi.fn().mockResolvedValue({ status }),
    register: vi.fn().mockResolvedValue({ error: null, user: { identities: [{}] } }),
    resend: vi.fn().mockResolvedValue({ error: null }),
    reset: vi.fn().mockResolvedValue({ error: null }),
  };
}
describe("Signup account rules", () => {
  it("trims whitespace and normalizes email casing", () => expect(normalizeEmail("  Person@Example.COM  ")).toBe("person@example.com"));
  it("does not register or email a confirmed account", async () => {
    const d = deps("confirmed");
    expect(await processSignupRequest(input, d)).toEqual({ status: "confirmed" });
    expect(d.register).not.toHaveBeenCalled(); expect(d.resend).not.toHaveBeenCalled();
  });
  it("returns awaiting confirmation without signing up an unconfirmed account again", async () => {
    const d = deps("unconfirmed");
    expect(await processSignupRequest(input, d)).toEqual({ status: "unconfirmed" });
    expect(d.register).not.toHaveBeenCalled(); expect(d.resend).not.toHaveBeenCalled();
  });
  it("looks up a new account before registration and returns confirmation only after success", async () => {
    const d = deps("new");
    expect(await processSignupRequest(input, d)).toEqual({ status: "created", requiresConfirmation: true, retryAfter: 60 });
    expect(d.check.mock.invocationCallOrder[0]).toBeLessThan(d.register.mock.invocationCallOrder[0] ?? Infinity);
    expect(d.register).toHaveBeenCalledWith("person@example.com", "testing-password", "https://taskbridge.example/auth");
  });
  it("does not claim confirmation if registration or email sending fails", async () => {
    const d = deps("new"); d.register.mockResolvedValue({ error: { message: "Email unavailable", status: 500 }, user: null });
    expect((await processSignupRequest(input, d)).status).toBe("error");
  });
  it("fails closed when the account check has a network failure", async () => {
    const d = deps("new"); d.check.mockRejectedValue(new Error("Network down"));
    expect((await processSignupRequest(input, d)).status).toBe("error"); expect(d.register).not.toHaveBeenCalled();
  });
  it("does not claim confirmation after registration network failure", async () => {
    const d = deps("new"); d.register.mockRejectedValue(new Error("Network down"));
    expect((await processSignupRequest(input, d)).status).toBe("error");
  });
  it("resends only for unconfirmed accounts with a 60-second cooldown", async () => {
    const d = deps("unconfirmed");
    expect(await processSignupRequest({ ...input, action: "resend" }, d)).toEqual({ status: "resent", retryAfter: CONFIRMATION_COOLDOWN_SECONDS });
    expect(CONFIRMATION_COOLDOWN_SECONDS).toBe(60);
    expect(d.resend).toHaveBeenCalledWith(input.email, "https://taskbridge.example/auth");
  });
  it("never resends confirmation to a confirmed account", async () => {
    const d = deps("confirmed");
    expect((await processSignupRequest({ ...input, action: "resend" }, d)).status).toBe("confirmed");
    expect(d.resend).not.toHaveBeenCalled();
  });
  it("blocks operations when the persistent limit rejects a request", async () => {
    const d = deps("limited"); d.check.mockResolvedValue({ status: "limited", retryAfter: 60 });
    expect(await processSignupRequest(input, d)).toEqual({ status: "limited", retryAfter: 60 });
    expect(d.register).not.toHaveBeenCalled(); expect(d.resend).not.toHaveBeenCalled();
  });
  it("handles a concurrent duplicate without reporting a new account", async () => {
    const d = deps("new"); d.register.mockResolvedValue({ error: null, user: { identities: [] } });
    d.check.mockResolvedValueOnce({ status: "new" }).mockResolvedValueOnce({ status: "confirmed" });
    expect((await processSignupRequest(input, d)).status).toBe("confirmed");
  });
  it("requests recovery with the public reset page", async () => {
    const d = deps("confirmed");
    expect((await processSignupRequest({ ...input, action: "reset" }, d)).status).toBe("reset");
    expect(d.reset).toHaveBeenCalledWith(input.email, "https://taskbridge.example/reset-password");
  });
  it("blocks repeated clicks synchronously until the request finishes", () => {
    const gate = createSubmissionGate();
    expect(gate.enter()).toBe(true); expect(gate.enter()).toBe(false); gate.leave(); expect(gate.enter()).toBe(true);
  });
});