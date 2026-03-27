import { Inbox } from 'lucide-react';
export function EmptyState({ icon: Icon = Inbox, title = 'Không có dữ liệu', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-gray-100 rounded-full mb-4">
        <Icon size={32} className="text-gray-400" />
      </div>
      <p className="text-base font-medium text-gray-500">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
