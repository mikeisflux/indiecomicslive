import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="icl-fade-up max-w-md">
        <p className="text-7xl font-black tracking-tight text-accent">404</p>
        <h1 className="mt-2 text-2xl font-bold">Off the map.</h1>
        <p className="mt-2 text-sm text-paper/60">
          That page doesn&rsquo;t exist or got pulled. Try one of these:
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(255,51,102,0.4)]"
          >
            Home
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold"
          >
            Search lots
          </Link>
          <Link
            href="/feed"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold"
          >
            Your feed
          </Link>
        </div>
      </div>
    </main>
  );
}
