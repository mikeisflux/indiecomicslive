import { revalidatePath } from "next/cache";
import { requireAdmin, logAudit } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_SEED = [
  { slug: "comics", name: "Comics", iconEmoji: "📚", position: 1 },
  { slug: "manga", name: "Manga", iconEmoji: "🍙", position: 2 },
  { slug: "trading-cards", name: "Trading Cards", iconEmoji: "🃏", position: 3 },
  { slug: "art-books", name: "Art Books", iconEmoji: "🎨", position: 4 },
  { slug: "original-art", name: "Original Art", iconEmoji: "✏️", position: 5 },
  { slug: "collectibles", name: "Collectibles", iconEmoji: "🧸", position: 6 },
  { slug: "vintage", name: "Vintage", iconEmoji: "📻", position: 7 },
  { slug: "adult", name: "Adult", iconEmoji: "🔞", position: 8 },
];

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const cats = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { position: "asc" },
  });

  async function seed() {
    "use server";
    const me = await requireAdmin("/admin/categories");
    for (const c of DEFAULT_SEED) {
      await prisma.category.upsert({
        where: { slug: c.slug },
        update: {},
        create: c,
      });
    }
    await logAudit({ actorId: me.id, action: "category.seed_defaults" });
    revalidatePath("/admin/categories");
  }

  async function add(formData: FormData) {
    "use server";
    const me = await requireAdmin("/admin/categories");
    const slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 50);
    const name = String(formData.get("name") ?? "").trim().slice(0, 60);
    const iconEmoji =
      String(formData.get("icon") ?? "").trim().slice(0, 4) || null;
    if (!slug || !name) return;
    await prisma.category.create({
      data: {
        slug,
        name,
        iconEmoji,
        position: 100,
      },
    });
    await logAudit({
      actorId: me.id,
      action: "category.create",
      targetKind: "category",
      metadata: { slug, name },
    });
    revalidatePath("/admin/categories");
  }

  async function remove(formData: FormData) {
    "use server";
    const me = await requireAdmin("/admin/categories");
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await prisma.category.delete({ where: { id } });
    await logAudit({
      actorId: me.id,
      action: "category.delete",
      targetKind: "category",
      targetId: id,
    });
    revalidatePath("/admin/categories");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-paper/60">
            Top-level categories surfaced on the homepage and /search.
          </p>
        </div>
        {cats.length === 0 && (
          <form action={seed}>
            <button className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-white">
              Seed defaults
            </button>
          </form>
        )}
      </div>

      <form
        action={add}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
      >
        <Field label="Name" name="name" placeholder="Manga" />
        <Field label="Slug" name="slug" placeholder="manga" />
        <Field label="Emoji" name="icon" placeholder="🍙" width="w-20" />
        <button className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-white">
          Add category
        </button>
      </form>

      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
        {cats.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{c.iconEmoji ?? "·"}</span>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-paper/40">/{c.slug}</p>
              </div>
            </div>
            <form action={remove}>
              <input type="hidden" name="id" value={c.id} />
              <button className="rounded-full border border-white/15 px-3 py-1 text-xs text-paper/70 hover:border-red-400 hover:text-red-300">
                Delete
              </button>
            </form>
          </li>
        ))}
        {cats.length === 0 && (
          <li className="px-4 py-6 text-sm text-paper/50">
            No categories yet. Click <strong>Seed defaults</strong> above.
          </li>
        )}
      </ul>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  width = "w-48",
}: {
  label: string;
  name: string;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="text-xs text-paper/60">
      <span className="mb-1 block uppercase tracking-widest">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className={`${width} rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-paper`}
        required={name !== "icon"}
      />
    </label>
  );
}
