"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("display_name") || "").trim();

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile`,
          data: displayName ? { display_name: displayName } : undefined,
        },
      });
      if (error) throw error;
      setMessage("Account created. Check your email if confirmation is enabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="energy-grid grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/60 p-7 shadow-2xl backdrop-blur-xl">
        <Link href="/" className="text-sm text-white/45 hover:text-white">← Back home</Link>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.25em] text-ki">Power access</p>
        <h1 className="mt-2 text-3xl font-black">{mode === "login" ? "Login" : "Create account"}</h1>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <input
              name="display_name"
              type="text"
              maxLength={60}
              placeholder="Display name"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki"
            />
          )}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Password"
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki"
          />
          <button disabled={busy} className="w-full rounded-2xl bg-ki px-4 py-3 font-black text-black shadow-ki disabled:opacity-50">
            {busy ? "Charging…" : mode === "login" ? "Enter" : "Register"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-white/70">{message}</p>}

        <div className="mt-5 flex items-center justify-between gap-4 text-sm">
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }} className="text-white/55 hover:text-white">
            {mode === "login" ? "Need an account?" : "Already registered?"}
          </button>
          {mode === "login" && <Link href="/forgot-password" className="text-ki/80 hover:text-ki">Forgot password?</Link>}
        </div>
      </div>
    </main>
  );
}
