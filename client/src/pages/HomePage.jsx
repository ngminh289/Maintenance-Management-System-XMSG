/**
 * HomePage.jsx — Trang chào + kiểm tra API /api/health (demo services/hooks).
 */
import { useHealth } from '../hooks/useHealth.js';

export function HomePage() {
  const { data, loading, error } = useHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-400/90">
        Warehouse · Bảo trì tài sản
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Base React + Express + MySQL
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">
        Cấu trúc theo rule: components, pages, services, hooks. Tailwind utility.
        Quét QR (camera) sẽ gắn vào trang field sau.
      </p>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="text-sm font-medium text-slate-300">GET /api/health</h2>
        {loading && (
          <p className="mt-3 text-sm text-slate-400">Đang kiểm tra API…</p>
        )}
        {error && (
          <p className="mt-3 text-sm text-rose-400">
            {error} (chạy server và import schema MySQL)
          </p>
        )}
        {data && (
          <pre className="mt-3 overflow-x-auto text-xs text-emerald-300/90">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
