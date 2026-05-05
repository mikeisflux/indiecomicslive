"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EditableApp = {
  userEmail: string;
  legalFirstName: string;
  legalLastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressCountry: string;
  storeName: string;
  storeBio: string;
  primaryWebsite: string | null;
  businessFilingState: string | null;
  businessFilingNumber: string | null;
  businessFilingUrl: string | null;
  taxIdLast4: string | null;
  unfulfilledCount: number;
  pastDeliveryIssues: boolean;
  contentCategories: string[];
  willListAdult: boolean;
  rejectionReason: string | null;
  reviewerNotes: string | null;
};

export default function EditApplication({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: EditableApp;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditableApp>(initial);

  function set<K extends keyof EditableApp>(k: K, v: EditableApp[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const r = await fetch(
      `/api/admin/seller-applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    setBusy(false);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      const issues = Array.isArray(data?.issues) ? data.issues : [];
      setError(
        issues.length
          ? issues
              .map((i: { path: string; message: string }) =>
                i.path ? `${i.path}: ${i.message}` : i.message,
              )
              .join(" · ")
          : (data.error ?? "Save failed"),
      );
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-paper hover:bg-white/5"
      >
        Edit fields directly
      </button>
    );
  }

  const inp =
    "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm";

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-paper/60">
          Inline edit
        </h2>
        <button
          onClick={() => {
            setForm(initial);
            setOpen(false);
          }}
          className="text-xs text-paper/60 hover:text-paper"
        >
          cancel
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs text-paper/60">
          Sign-in / contact email
        </label>
        <input
          className={inp}
          type="email"
          placeholder="seller@example.com"
          value={form.userEmail}
          onChange={(e) => set("userEmail", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          placeholder="Legal first name"
          value={form.legalFirstName}
          onChange={(e) => set("legalFirstName", e.target.value)}
        />
        <input
          className={inp}
          placeholder="Legal last name"
          value={form.legalLastName}
          onChange={(e) => set("legalLastName", e.target.value)}
        />
      </div>
      <input
        className={inp}
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => set("phone", e.target.value)}
      />

      <input
        className={inp}
        placeholder="Address line 1"
        value={form.addressLine1}
        onChange={(e) => set("addressLine1", e.target.value)}
      />
      <input
        className={inp}
        placeholder="Address line 2"
        value={form.addressLine2 ?? ""}
        onChange={(e) => set("addressLine2", e.target.value || null)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          placeholder="City"
          value={form.addressCity}
          onChange={(e) => set("addressCity", e.target.value)}
        />
        <input
          className={inp}
          placeholder="State"
          value={form.addressState}
          onChange={(e) => set("addressState", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          placeholder="ZIP"
          value={form.addressZip}
          onChange={(e) => set("addressZip", e.target.value)}
        />
        <input
          className={inp}
          placeholder="Country"
          value={form.addressCountry}
          onChange={(e) => set("addressCountry", e.target.value)}
        />
      </div>

      <input
        className={inp}
        placeholder="Store name"
        value={form.storeName}
        onChange={(e) => set("storeName", e.target.value)}
      />
      <textarea
        className={inp}
        rows={4}
        placeholder="Store bio"
        value={form.storeBio}
        onChange={(e) => set("storeBio", e.target.value)}
      />
      <input
        className={inp}
        placeholder="Primary website"
        value={form.primaryWebsite ?? ""}
        onChange={(e) => set("primaryWebsite", e.target.value || null)}
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          placeholder="Filing state"
          value={form.businessFilingState ?? ""}
          onChange={(e) => set("businessFilingState", e.target.value || null)}
        />
        <input
          className={inp}
          placeholder="Filing number"
          value={form.businessFilingNumber ?? ""}
          onChange={(e) => set("businessFilingNumber", e.target.value || null)}
        />
      </div>
      <input
        className={inp}
        placeholder="Filing URL"
        value={form.businessFilingUrl ?? ""}
        onChange={(e) => set("businessFilingUrl", e.target.value || null)}
      />
      <input
        className={inp}
        placeholder="Tax ID last 4"
        maxLength={4}
        value={form.taxIdLast4 ?? ""}
        onChange={(e) => set("taxIdLast4", e.target.value || null)}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            className={inp}
            value={form.unfulfilledCount}
            onChange={(e) =>
              set("unfulfilledCount", Math.max(0, Number(e.target.value) || 0))
            }
          />
          <span className="text-xs text-paper/60">unfulfilled</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.pastDeliveryIssues}
            onChange={(e) => set("pastDeliveryIssues", e.target.checked)}
          />
          <span>Past delivery issues</span>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.willListAdult}
          onChange={(e) => set("willListAdult", e.target.checked)}
        />
        <span>Will list adult content</span>
      </label>

      <textarea
        className={inp}
        rows={2}
        placeholder="Reviewer notes (admin-only)"
        value={form.reviewerNotes ?? ""}
        onChange={(e) => set("reviewerNotes", e.target.value || null)}
      />
      <input
        className={inp}
        placeholder="Rejection reason"
        value={form.rejectionReason ?? ""}
        onChange={(e) => set("rejectionReason", e.target.value || null)}
      />

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setForm(initial);
            setOpen(false);
          }}
          className="rounded-full border border-white/15 px-4 py-2 text-xs"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
