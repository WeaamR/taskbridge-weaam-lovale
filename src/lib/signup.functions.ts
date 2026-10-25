import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { normalizeEmail } from "./signup";

const signupInput = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.string().email().max(254)),
  password: z.string().max(128).optional(),
  action: z.enum(["signup", "resend", "reset"]),
}).superRefine((value, ctx) => {
  if (value.action === "signup" && (!value.password || value.password.length < 6)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Password must be at least 6 characters.", path: ["password"] });
  }
});

export const requestSignup = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof signupInput>) => signupInput.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const origin = new URL(request.url).origin;
    if (request.headers.get("origin") !== origin) return { status: "error" as const, message: "Please submit this request from TaskBridge." };
    // Trust only the platform's client-IP header; never caller-supplied X-Forwarded-For.
    // Without a trusted IP, all requests share a fail-safe bucket.
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processSignupRequest } = await import("./signup-service.server");
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return { status: "error" as const, message: "Signup is temporarily unavailable. Please try again later." };
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    return processSignupRequest({ ...data, ip, origin }, {
      check: async (email, ip, action) => {
        const { data: result, error } = await supabaseAdmin.rpc("check_signup_request", { p_email: email, p_ip: ip, p_action: action });
        if (error || !result || typeof result !== "object" || Array.isArray(result)) throw new Error("Protection unavailable");
        const status = result["status"];
        if (typeof status !== "string") throw new Error("Invalid protection response");
        return { status, retryAfter: typeof result["retryAfter"] === "number" ? result["retryAfter"] : undefined };
      },
      register: async (email, password, redirect) => {
        const { data: result, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        return { user: result.user, error };
      },
      resend: (email, redirect) => client.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirect } }),
      reset: (email, redirect) => client.auth.resetPasswordForEmail(email, { redirectTo: redirect }),
    });
  });