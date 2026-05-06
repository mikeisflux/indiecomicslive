export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border-2 border-white/10" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-paper/40">
          loading
        </p>
      </div>
    </div>
  );
}
