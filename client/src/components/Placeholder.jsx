/**
 * Placeholder.jsx — Component mẫu tái sử dụng (thay bằng UI thật khi làm chức năng).
 */
export function Placeholder({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-white/20 p-4 text-sm text-slate-400 ${className}`}
    >
      {children}
    </div>
  );
}
