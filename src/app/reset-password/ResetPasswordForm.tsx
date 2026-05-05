"use client";

import { useActionState } from "react";
import RecaptchaWidget from "@/components/RecaptchaWidget";
import { resetPasswordAction, type ResetPasswordResult } from "./actions";

export default function ResetPasswordForm({
  token,
  siteKey,
}: {
  token: string;
  siteKey: string | null;
}) {
  const [state, formAction, pending] = useActionState<ResetPasswordResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          New password <span className="text-paper/40">(8+ characters)</span>
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          className={inp}
        />
      </div>
      <RecaptchaWidget siteKey={siteKey} />
      {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save and sign in"}
      </button>
    </form>
  );
}
