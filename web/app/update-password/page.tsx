"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated. You can continue to your profile.");
      setTimeout(() => { window.location.href = "/profile"; }, 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.04] p-7">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Recovery</p>
        <h1 className="mt-2 text-3xl font-black">Choose a new password</h1>
        <input name="password" type="password" minLength={8} required placeholder="New password" className="mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-ki" />
        <button disabled={busy} className="mt-4 w-full rounded-2xl bg-ki px-4 py-3 font-black text-black disabled:opacity-50">
          {busy ? "Updating…" : "Update password"}
        </button>
        {message && <p className="mt-4 text-sm text-white/65">{message}</p>}
      </form>
    </main>
  );
}
