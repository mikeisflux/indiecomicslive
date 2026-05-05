"use client";

import { useActionState } from "react";
import RecaptchaWidget from "@/components/RecaptchaWidget";
import { forgotPasswordAction, type ForgotPasswordResult } from "./actions";

export default function ForgotPasswordForm({ siteKey }: { siteKey: string | null }) {
  const [state, formAction, pending] = useActionState<ForgotPasswordResult | null, FormData>(
    forgotPasswordAction,
    null,
  );

  if (state?.sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        If that email matches an account, we just sent a reset link. Check your inbox (and spam).
      </div>
    );
  }

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-paper/60">Email</label>
        <input name="email" type="email" required autoFocus className={inp} />
      </div>
      <RecaptchaWidget siteKey={siteKey} />
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
