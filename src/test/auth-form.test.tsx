import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/AuthForm";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => request }));
vi.mock("@/lib/signup.functions", () => ({ requestSignup: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signInWithPassword: vi.fn() } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
function form() {
  render(<AuthForm initialMode="signup" onSignedIn={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  Person@Example.COM  " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-test" } });
  const button = screen.getByRole("button", { name: "Create account" });
  const parent = button.closest("form"); if (!parent) throw new Error("Missing form");
  return parent;
}
describe("Signup interactions", () => {
  it("submits normalized emails only once while pending", async () => {
    let resolve: (value: unknown) => void = () => {};
    request.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const parent = form(); fireEvent.submit(parent); fireEvent.submit(parent);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ data: { email: "person@example.com", password: "password-test", action: "signup" } });
    await act(async () => resolve({ status: "confirmed" }));
  });
  it("offers sign-in and recovery without another signup for confirmed accounts", async () => {
    request.mockResolvedValue({ status: "confirmed" }); fireEvent.submit(form());
    await waitFor(() => expect(screen.getByRole("button", { name: /^Sign In$/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("prevents repeated resend clicks throughout the cooldown", async () => {
    request.mockResolvedValueOnce({ status: "unconfirmed" }).mockResolvedValueOnce({ status: "resent", retryAfter: 60 });
    fireEvent.submit(form());
    const resend = await screen.findByRole("button", { name: "Resend confirmation email" });
    fireEvent.click(resend); fireEvent.click(resend);
    await waitFor(() => expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled());
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("allows retry after network failures without creating a success state", async () => {
    request.mockRejectedValue(new Error("Network down")); fireEvent.submit(form());
    await waitFor(() => expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).toBeNull();
  });
});