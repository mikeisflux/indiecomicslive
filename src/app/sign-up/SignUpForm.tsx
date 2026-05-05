"use client";

import { useActionState } from "react";
import RecaptchaWidget from "@/components/RecaptchaWidget";
import { signUpAction, type SignUpResult } from "./actions";

export default function SignUpForm({
  siteKey,
  callbackUrl,
}: {
  siteKey: string | null;
  callbackUrl: string;
}) {
  const [state, formAction, pending] = useActionState<SignUpResult | null, FormData>(
    signUpAction,
    null,
  );

  const inp = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label className="mb-1 block text-xs text-paper/60">Display name</label>
        <input name="name" type="text" autoComplete="name" className={inp} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Email <span className="text-accent">*</span>
        </label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inp}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Password <span className="text-accent">*</span>{" "}
          <span className="text-paper/40">(8+ characters)</span>
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {pending ? "Creating…" : "Create account"}
      </button>

      <p className="text-center text-[11px] text-paper/40">
        By creating an account, you agree to the{" "}
        <a href="/legal/terms" className="hover:text-paper underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/legal/privacy" className="hover:text-paper underline">
          Privacy
        </a>{" "}
        policies.
      </p>
    </form>
  );
}
