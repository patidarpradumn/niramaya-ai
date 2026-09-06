import { type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, InboxIcon } from 'lucide-react';

// Empty State
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon || <InboxIcon size={24} />}
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 max-w-xs">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Error State
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load data',
  description = 'Something went wrong while loading this information. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-400 mb-4">
        <AlertTriangle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}
