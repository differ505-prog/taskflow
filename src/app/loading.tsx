export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)]">
      <div className="spinner" role="status" aria-label="載入中" />
    </div>
  );
}
