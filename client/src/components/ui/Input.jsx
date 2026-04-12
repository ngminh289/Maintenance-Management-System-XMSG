/**
 * Input.jsx — Input + Select + Textarea với contrast tốt (placeholder đậm hơn — đọc được trên nền trắng).
 */
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-gray-800">{label}</label>}
      <input
        className={`border rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors
          border-gray-300 bg-white placeholder:text-gray-600 placeholder:opacity-100
          focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
          disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-400 focus:ring-red-500/20' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-gray-800">{label}</label>}
      <select
        className={`border rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors
          border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
          ${error ? 'border-red-400' : ''}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-gray-800">{label}</label>}
      <textarea
        rows={3}
        className={`border rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors resize-none
          border-gray-300 bg-white placeholder:text-gray-600 placeholder:opacity-100
          focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
          ${error ? 'border-red-400' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
