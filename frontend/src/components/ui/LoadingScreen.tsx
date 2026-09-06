// Loading states: skeleton shimmer and full loading screen

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return <div className={`shimmer rounded-md ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex justify-between items-start">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-3 ${i === 0 ? 'w-36' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

import { NiramayaLogo } from '../../assets/Logo';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#060D1F] flex flex-col items-center justify-center gap-6">
      <div className="ai-pulse flex flex-col items-center gap-4">
        <NiramayaLogo variant="full" size={48} />
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
          <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  );
}
