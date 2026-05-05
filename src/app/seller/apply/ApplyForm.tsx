"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const NmiCardForm = dynamic(
  () => import("@/components/payments/NmiCardForm").then((m) => m.NmiCardForm),
  { ssr: false },
);

type ExistingApp = {
  status: string;
  storeName?: string | null;
  storeBio?: string | null;
  legalFirstName?: string | null;
  legalLastName?: string | null;
  rejectionReason?: string | null;
} | null;

type BankInfo = {
  bankNameDisplay: string | null;
  accountLastFour: string | null;
  accountType: string;
} | null;

type ChargebackCard = {
  cardBrand: string | null;
  cardLastFour: string;
} | null;

type Props = {
  existing: ExistingApp;
  bank: BankInfo;
  chargebackCard: ChargebackCard;
  nmiPublicKey: string | null;
};

export default function ApplyForm({
  existing,
  bank,
  chargebackCard,
  nmiPublicKey,
}: Props) {
  // Read previously-saved form state from localStorage at first mount.
  // Done in useState lazy initializers so render 1 already shows the
  // restored values — no race against an effect that would otherwise
  // overwrite localStorage with empty defaults.
  const STORAGE_KEY = "icl_apply_state_v1";
  type SavedState = {
    identity?: Partial<{
      legalFirstName: string;
      legalLastName: string;
      dateOfBirth: string;
      phone: string;
      addressLine1: string;
      addressLine2: string;
      addressCity: string;
      addressState: string;
      addressZip: string;
      addressCountry: string;
    }>;
    business?: Partial<{
      storeName: string;
      storeBio: string;
      primaryWebsite: string;
      twitter: string;
      instagram: string;
      youtube: string;
      tiktok: string;
      bluesky: string;
      contentCategories: string[];
      willListAdult: boolean;
      unfulfilledCount: number;
      pastDeliveryIssues: boolean;
    }>;
    step?: string;
    agreeSeller?: boolean;
    agreeContent?: boolean;
    agreeNsfw?: boolean;
  };
  function readSavedState(): SavedState | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedState) : null;
    } catch {
      return null;
    }
  }
  const savedRef = useRef<SavedState | null>(null);
  if (savedRef.current === null) savedRef.current = readSavedState();
  const saved = savedRef.current;

  const [step, setStep] = useState<
    "identity" | "business" | "bank" | "chargeback" | "agree" | "review"
  >(() => {
    if (existing?.status) return "review";
    const s = saved?.step;
    if (
      s === "identity" ||
      s === "business" ||
      s === "bank" ||
      s === "chargeback" ||
      s === "agree"
    ) {
      return s;
    }
    return "identity";
  });

  const [identity, setIdentity] = useState(() => ({
    legalFirstName: existing?.legalFirstName ?? "",
    legalLastName: existing?.legalLastName ?? "",
    dateOfBirth: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    addressCountry: "US",
    ...(saved?.identity ?? {}),
  }));

  const [business, setBusiness] = useState(() => ({
    storeName: existing?.storeName ?? "",
    storeBio: existing?.storeBio ?? "",
    primaryWebsite: "",
    twitter: "",
    instagram: "",
    youtube: "",
    tiktok: "",
    bluesky: "",
    contentCategories: [] as string[],
    willListAdult: false,
    unfulfilledCount: 0,
    pastDeliveryIssues: false,
    ...(saved?.business ?? {}),
  }));

  const [bankSaved, setBankSaved] = useState(!!bank);
  const [chargebackSaved, setChargebackSaved] = useState(!!chargebackCard);

  const [agreeSeller, setAgreeSeller] = useState(saved?.agreeSeller ?? false);
  const [agreeContent, setAgreeContent] = useState(saved?.agreeContent ?? false);
  const [agreeNsfw, setAgreeNsfw] = useState(saved?.agreeNsfw ?? false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(existing?.status === "submitted");

  // Persist on every change. Skip the first run so the initial render
  // doesn't immediately rewrite the same data we just loaded.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ identity, business, step, agreeSeller, agreeContent, agreeNsfw }),
      );
    } catch {
      /* quota exceeded etc — fine to skip */
    }
  }, [identity, business, step, agreeSeller, agreeContent, agreeNsfw]);

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  if (step === "review" && existing) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-paper/60">
          Application status
        </p>
        <p className="mt-1 text-2xl font-bold capitalize">
          {existing.status.replace(/_/g, " ")}
        </p>
        {existing.rejectionReason && (
          <p className="mt-3 text-sm text-accent">
            Reason: {existing.rejectionReason.replace(/_/g, " ")}
          </p>
        )}
        {existing.status === "submitted" && (
          <p className="mt-3 text-sm text-paper/70">
            We&rsquo;ll email you when we&rsquo;ve reviewed your application.
            Usually 2&ndash;3 business days.
          </p>
        )}
        <button
          onClick={() => setStep("identity")}
          className="mt-6 rounded-full border border-white/10 px-4 py-2 text-sm"
        >
          Edit application
        </button>
      </div>
    );
  }

  async function submitApp() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/seller/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legalFirstName: identity.legalFirstName,
          legalLastName: identity.legalLastName,
          dateOfBirth: identity.dateOfBirth,
          phone: identity.phone,
          addressLine1: identity.addressLine1,
          addressLine2: identity.addressLine2 || undefined,
          addressCity: identity.addressCity,
          addressState: identity.addressState,
          addressZip: identity.addressZip,
          addressCountry: identity.addressCountry,
          storeName: business.storeName,
          storeBio: business.storeBio,
          primaryWebsite: business.primaryWebsite || undefined,
          socialLinks: {
            twitter: business.twitter || undefined,
            instagram: business.instagram || undefined,
            youtube: business.youtube || undefined,
            tiktok: business.tiktok || undefined,
            bluesky: business.bluesky || undefined,
          },
          unfulfilledCount: business.unfulfilledCount,
          pastDeliveryIssues: business.pastDeliveryIssues,
          contentCategories: business.contentCategories,
          willListAdult: business.willListAdult,
          agreedToSellerAgreement: agreeSeller,
          agreedToContentPolicy: agreeContent,
          agreedToNsfwPolicy: agreeNsfw,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        // The route returns { error, issues: [{ path, message }] } when zod
        // rejects. Surface every offending field so the seller knows what
        // to fix instead of the opaque 'invalid_body' string.
        const issues = Array.isArray(data?.issues) ? data.issues : [];
        if (issues.length > 0) {
          setError(
            issues
              .map((i: { path: string; message: string }) =>
                i.path ? `${i.path}: ${i.message}` : i.message,
              )
              .join(" · "),
          );
        } else {
          setError(data.error ?? "Submission failed");
        }
        return;
      }
      setSubmitted(true);
      setStep("review");
      // Wipe the saved draft now that the server has the canonical copy.
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <Stepper
        current={step}
        steps={[
          ["identity", "Identity"],
          ["business", "Business"],
          ["bank", "Payouts"],
          ["chargeback", "Chargeback card"],
          ["agree", "Agree"],
        ]}
      />

      {step === "identity" && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-lg font-bold">Your identity</h2>
          <p className="text-xs text-paper/60">
            Required for KYC. We never share this with buyers.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Legal first name"
              value={identity.legalFirstName}
              onChange={(e) =>
                setIdentity({ ...identity, legalFirstName: e.target.value })
              }
              className={inputClass}
              required
            />
            <input
              placeholder="Legal last name"
              value={identity.legalLastName}
              onChange={(e) =>
                setIdentity({ ...identity, legalLastName: e.target.value })
              }
              className={inputClass}
              required
            />
          </div>
          <input
            type="date"
            value={identity.dateOfBirth}
            onChange={(e) =>
              setIdentity({ ...identity, dateOfBirth: e.target.value })
            }
            className={inputClass}
            required
          />
          <input
            placeholder="Phone"
            value={identity.phone}
            onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
            className={inputClass}
            required
          />
          <input
            placeholder="Street"
            value={identity.addressLine1}
            onChange={(e) =>
              setIdentity({ ...identity, addressLine1: e.target.value })
            }
            className={inputClass}
            required
          />
          <input
            placeholder="Apt / suite"
            value={identity.addressLine2}
            onChange={(e) =>
              setIdentity({ ...identity, addressLine2: e.target.value })
            }
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="City"
              value={identity.addressCity}
              onChange={(e) =>
                setIdentity({ ...identity, addressCity: e.target.value })
              }
              className={inputClass}
              required
            />
            <input
              placeholder="State"
              value={identity.addressState}
              onChange={(e) =>
                setIdentity({ ...identity, addressState: e.target.value })
              }
              className={inputClass}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="ZIP"
              value={identity.addressZip}
              onChange={(e) =>
                setIdentity({ ...identity, addressZip: e.target.value })
              }
              className={inputClass}
              required
            />
            <input
              placeholder="Country"
              maxLength={2}
              value={identity.addressCountry}
              onChange={(e) =>
                setIdentity({
                  ...identity,
                  addressCountry: e.target.value.toUpperCase(),
                })
              }
              className={inputClass}
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep("business")}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === "business" && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-lg font-bold">Your store</h2>
          <input
            placeholder="Store name (shown to buyers)"
            value={business.storeName}
            onChange={(e) =>
              setBusiness({ ...business, storeName: e.target.value })
            }
            className={inputClass}
            required
          />
          <textarea
            placeholder="Store bio — what you sell, how you ship, why people should buy from you"
            value={business.storeBio}
            onChange={(e) =>
              setBusiness({ ...business, storeBio: e.target.value })
            }
            rows={5}
            minLength={20}
            className={inputClass}
            required
          />
          <input
            placeholder="Primary website (optional)"
            value={business.primaryWebsite}
            onChange={(e) =>
              setBusiness({ ...business, primaryWebsite: e.target.value })
            }
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Twitter / X URL"
              value={business.twitter}
              onChange={(e) =>
                setBusiness({ ...business, twitter: e.target.value })
              }
              className={inputClass}
            />
            <input
              placeholder="Instagram URL"
              value={business.instagram}
              onChange={(e) =>
                setBusiness({ ...business, instagram: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="YouTube URL"
              value={business.youtube}
              onChange={(e) =>
                setBusiness({ ...business, youtube: e.target.value })
              }
              className={inputClass}
            />
            <input
              placeholder="TikTok URL"
              value={business.tiktok}
              onChange={(e) =>
                setBusiness({ ...business, tiktok: e.target.value })
              }
              className={inputClass}
            />
          </div>

          <CategoryPicker
            value={business.contentCategories}
            onChange={(v) =>
              setBusiness({ ...business, contentCategories: v })
            }
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={business.willListAdult}
              onChange={(e) =>
                setBusiness({ ...business, willListAdult: e.target.checked })
              }
            />
            I plan to list adult / NSFW content
          </label>

          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
              Prior platforms
            </p>
            <p className="mt-1 text-xs text-paper/60">
              Required honesty check. Same auto-disqualification rules as
              indiecrowdfund: 3+ unfulfilled campaigns or any campaign over a
              year past delivery is an instant decline.
            </p>
            <label className="mt-3 block text-xs">
              How many campaigns / runs do you have unfulfilled across all
              platforms?
              <input
                type="number"
                min={0}
                value={business.unfulfilledCount}
                onChange={(e) =>
                  setBusiness({
                    ...business,
                    unfulfilledCount: Number(e.target.value),
                  })
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={business.pastDeliveryIssues}
                onChange={(e) =>
                  setBusiness({
                    ...business,
                    pastDeliveryIssues: e.target.checked,
                  })
                }
              />
              I have a campaign more than one year past its stated delivery
              date.
            </label>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep("identity")}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm"
            >
              Back
            </button>
            <button
              onClick={() => setStep("bank")}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === "bank" && (
        <BankSection
          saved={bankSaved}
          onSaved={() => setBankSaved(true)}
          onBack={() => setStep("business")}
          onNext={() => setStep("chargeback")}
        />
      )}

      {step === "chargeback" && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-lg font-bold">Chargeback recovery card</h2>
          <p className="text-xs text-paper/60">
            PaymentCloud requires sellers to keep a card on file. If
            chargebacks exceed your rolling reserve, this card is debited to
            recoup. Your buyers never see it.
          </p>
          {chargebackSaved ? (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Card on file. You&rsquo;re all set.
            </p>
          ) : nmiPublicKey ? (
            <NmiCardForm
              publicKey={nmiPublicKey}
              onSuccess={() => setChargebackSaved(true)}
              onError={(m) => setError(m)}
            />
          ) : (
            <p className="text-sm text-accent">
              PaymentCloud not configured. Contact support.
            </p>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep("bank")}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm"
            >
              Back
            </button>
            <button
              onClick={() => setStep("agree")}
              disabled={!chargebackSaved}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === "agree" && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-lg font-bold">Agreements</h2>
          <Checkbox
            checked={agreeSeller}
            onChange={setAgreeSeller}
            label={
              <>
                I agree to the{" "}
                <a
                  href="/legal/seller-agreement"
                  target="_blank"
                  className="underline"
                >
                  Seller Responsibility Agreement
                </a>{" "}
                and the{" "}
                <a href="/legal/terms" target="_blank" className="underline">
                  Terms of Service
                </a>
                .
              </>
            }
          />
          <Checkbox
            checked={agreeContent}
            onChange={setAgreeContent}
            label={
              <>
                I have read the{" "}
                <a
                  href="/legal/content-guidelines"
                  target="_blank"
                  className="underline"
                >
                  Content Guidelines
                </a>{" "}
                and will only list permitted items.
              </>
            }
          />
          {business.willListAdult && (
            <Checkbox
              checked={agreeNsfw}
              onChange={setAgreeNsfw}
              label={
                <>
                  I have read the{" "}
                  <a href="/legal/nsfw" target="_blank" className="underline">
                    NSFW Policy
                  </a>{" "}
                  and confirm all depicted persons are 18+ and all material is
                  legal in my jurisdiction.
                </>
              }
            />
          )}
          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="flex justify-between">
            <button
              onClick={() => setStep("chargeback")}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm"
            >
              Back
            </button>
            <button
              onClick={submitApp}
              disabled={
                submitting ||
                !agreeSeller ||
                !agreeContent ||
                (business.willListAdult && !agreeNsfw)
              }
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stepper({
  current,
  steps,
}: {
  current: string;
  steps: [string, string][];
}) {
  const idx = steps.findIndex(([k]) => k === current);
  return (
    <ol className="flex items-center gap-2 text-xs text-paper/60">
      {steps.map(([k, label], i) => (
        <li key={k} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              i <= idx ? "bg-accent text-white" : "bg-white/10"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "text-paper" : ""}>{label}</span>
          {i < steps.length - 1 && <span className="text-paper/30">→</span>}
        </li>
      ))}
    </ol>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const options = [
    "Indie comics",
    "Mainstream comics (back issues / variants)",
    "Adult / NSFW comics",
    "Art books",
    "Sketch covers / original art",
    "TCG (Pokemon, MTG, etc.)",
    "Sports cards",
    "Slabs (CGC / PSA / etc.)",
    "Manga",
    "Webtoons / digital",
  ];
  function toggle(opt: string) {
    onChange(
      value.includes(opt)
        ? value.filter((v) => v !== opt)
        : [...value, opt],
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-paper/60">
        What will you sell?
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1 text-xs ${
              value.includes(opt)
                ? "border-accent bg-accent/20 text-accent"
                : "border-white/10"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function BankSection({
  saved,
  onSaved,
  onBack,
  onNext,
}: {
  saved: boolean;
  onSaved: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [form, setForm] = useState({
    bankName: "",
    accountHolderFirstName: "",
    accountHolderLastName: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/seller/bank-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-lg font-bold">Payouts</h2>
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Bank account on file. Encrypted at rest.
        </p>
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
          >
            Next
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
    >
      <h2 className="text-lg font-bold">Payouts (bank account)</h2>
      <p className="text-xs text-paper/60">
        Encrypted at rest with AES-256-GCM. Plaintext never hits disk.
      </p>
      <input
        placeholder="Bank name"
        value={form.bankName}
        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
        className={inputClass}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Account holder first name"
          value={form.accountHolderFirstName}
          onChange={(e) =>
            setForm({ ...form, accountHolderFirstName: e.target.value })
          }
          className={inputClass}
          required
        />
        <input
          placeholder="Last name"
          value={form.accountHolderLastName}
          onChange={(e) =>
            setForm({ ...form, accountHolderLastName: e.target.value })
          }
          className={inputClass}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Routing # (9 digits)"
          value={form.routingNumber}
          onChange={(e) =>
            setForm({ ...form, routingNumber: e.target.value })
          }
          className={inputClass}
          required
        />
        <input
          placeholder="Account #"
          value={form.accountNumber}
          onChange={(e) =>
            setForm({ ...form, accountNumber: e.target.value })
          }
          className={inputClass}
          required
        />
      </div>
      <select
        value={form.accountType}
        onChange={(e) => setForm({ ...form, accountType: e.target.value })}
        className={inputClass}
      >
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
      </select>

      <p className="text-xs font-semibold uppercase tracking-widest text-paper/60">
        Billing address (must match bank)
      </p>
      <input
        placeholder="Street"
        value={form.billingLine1}
        onChange={(e) => setForm({ ...form, billingLine1: e.target.value })}
        className={inputClass}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="City"
          value={form.billingCity}
          onChange={(e) => setForm({ ...form, billingCity: e.target.value })}
          className={inputClass}
          required
        />
        <input
          placeholder="State"
          value={form.billingState}
          onChange={(e) =>
            setForm({ ...form, billingState: e.target.value })
          }
          className={inputClass}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="ZIP"
          value={form.billingZip}
          onChange={(e) => setForm({ ...form, billingZip: e.target.value })}
          className={inputClass}
          required
        />
        <input
          placeholder="Country"
          maxLength={2}
          value={form.billingCountry}
          onChange={(e) =>
            setForm({
              ...form,
              billingCountry: e.target.value.toUpperCase(),
            })
          }
          className={inputClass}
          required
        />
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/10 px-5 py-2.5 text-sm"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save bank info"}
        </button>
      </div>
    </form>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
