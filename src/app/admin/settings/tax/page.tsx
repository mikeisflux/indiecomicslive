import { revalidatePath } from "next/cache";
import { requireAdmin, logAudit } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { clearSalesTaxCache } from "@/lib/sales-tax";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sales tax — Admin",
  robots: { index: false, follow: false },
};

const US_STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"],
  ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

export default async function AdminTaxSettings() {
  await requireAdmin("/admin/settings/tax");
  const ps = await prisma.platformSetting.findUnique({
    where: { id: "default" },
    select: { salesTaxRatesByState: true },
  });
  const current = (ps?.salesTaxRatesByState ?? {}) as Record<string, number>;

  async function save(formData: FormData) {
    "use server";
    const me = await requireAdmin("/admin/settings/tax");
    const next: Record<string, number> = {};
    for (const { code } of US_STATES) {
      const raw = String(formData.get(`bps-${code}`) ?? "").trim();
      if (!raw) continue;
      const n = Math.round(Number(raw));
      if (Number.isFinite(n) && n > 0 && n <= 2000) next[code] = n;
    }
    await prisma.platformSetting.upsert({
      where: { id: "default" },
      update: { salesTaxRatesByState: next, updatedBy: me.id },
      create: {
        id: "default",
        salesTaxRatesByState: next,
        updatedBy: me.id,
      },
    });
    clearSalesTaxCache();
    await logAudit({
      actorId: me.id,
      action: "platform.tax_rates_save",
      metadata: { count: Object.keys(next).length },
    });
    revalidatePath("/admin/settings/tax");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales tax</h1>
        <p className="text-sm text-paper/60">
          Per-state rates in basis points (850 = 8.50%). Only states with
          a value collect tax. Leave a state blank if we don&rsquo;t have
          nexus there. Cache clears on save.
        </p>
      </div>

      <form action={save} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {US_STATES.map((s) => (
            <label
              key={s.code}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <span>
                <span className="font-mono text-xs text-paper/40">
                  {s.code}
                </span>{" "}
                {s.name}
              </span>
              <input
                name={`bps-${s.code}`}
                defaultValue={current[s.code] ?? ""}
                placeholder="—"
                className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-right text-xs"
                inputMode="numeric"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button className="rounded-full bg-accent px-6 py-2 text-xs font-bold text-white">
            Save rates
          </button>
        </div>
      </form>
    </div>
  );
}
