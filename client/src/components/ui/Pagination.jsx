import { ChevronLeft, ChevronRight } from 'lucide-react';
export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onChange(page - 1)} disabled={page <= 1}
        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
      ><ChevronLeft size={16} /></button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
        .reduce((acc, p, idx, arr) => {
          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
          acc.push(p);
          return acc;
        }, [])
        .map((p, idx) =>
          p === '…'
            ? <span key={idx} className="px-1 text-gray-400">…</span>
            : <button key={p} onClick={() => onChange(p)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors
                  ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >{p}</button>
        )}
      <button
        onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
      ><ChevronRight size={16} /></button>
    </div>
  );
}
