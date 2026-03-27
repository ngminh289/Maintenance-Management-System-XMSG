/**
 * Card.jsx — Card container với header tùy chọn.
 */
export function Card({ title, action, children, className = '', noPad = false }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, color = 'blue', sub }) {
  const bg = {
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red:    'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-xl ${bg[color] ?? bg.blue}`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-600 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
