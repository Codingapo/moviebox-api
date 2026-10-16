"use client";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button onClick={logout} className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/5">
      Sign out
    </button>
  );
}
