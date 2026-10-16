"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const supabase = createClient();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      setMessage(mode === "login" ? "Signed in." : "Registration created. Check your email if confirmation is enabled.");
      if (mode === "login") window.location.href = "/";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.04] p-7 shadow-2xl backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Power access</p>
        <h1 className="mt-2 text-3xl font-black">{mode === "login" ? "Login" : "Create account"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki" />
          <input name="password" type="password" required minLength={8} placeholder="Password" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki" />
          <button className="w-full rounded-2xl bg-ki px-4 py-3 font-black text-black">{mode === "login" ? "Enter" : "Register"}</button>
        </form>
        {message && <p className="mt-4 text-sm text-white/70">{message}</p>}
        <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 text-sm text-white/55 hover:text-white">
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </main>
  );
}
