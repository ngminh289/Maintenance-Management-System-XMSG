/**
 * Badge.jsx — Badge trạng thái với màu đậm hơn để dễ đọc.
 */
const COLORS = {
  green:  'bg-green-100 text-green-800 ring-1 ring-green-300/50',
  blue:   'bg-blue-100 text-blue-800 ring-1 ring-blue-300/50',
  yellow: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300/50',
  orange: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300/50',
  red:    'bg-red-100 text-red-800 ring-1 ring-red-300/50',
  gray:    'bg-gray-100 text-gray-700 ring-1 ring-gray-300/50',
  indigo:  'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300/50',
  purple:  'bg-purple-100 text-purple-800 ring-1 ring-purple-300/50',
};

export function Badge({ color = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLORS[color] ?? COLORS.gray} ${className}`}>
      {children}
    </span>
  );
}
