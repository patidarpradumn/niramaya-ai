import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  trendColor?: string;
  subLabel?: string;
  valueColor?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  iconBg = 'bg-blue-50',
  trend,
  trendType = 'neutral',
  trendColor,
  subLabel,
  valueColor = 'text-gray-900',
  className = '',
}: MetricCardProps) {
  const TrendIcon = trendType === 'up' ? TrendingUp : trendType === 'down' ? TrendingDown : Minus;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-gray-300 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
        </div>
        <div className={`p-2 rounded-xl ${iconBg} shadow-inner`}>{icon}</div>
      </div>
      <div>
        <div className={`text-2xl font-black tracking-tight ${valueColor}`}>{value}</div>
        {(trend || subLabel) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend && (
              <>
                <div className={`flex items-center justify-center p-0.5 rounded-full ${trendType === 'up' ? 'bg-green-100' : trendType === 'down' ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <TrendIcon
                    size={10}
                    className={trendColor || (trendType === 'up' ? 'text-green-600' : trendType === 'down' ? 'text-red-600' : 'text-gray-500')}
                  />
                </div>
                <span className={`text-xs font-bold ${trendColor || (trendType === 'up' ? 'text-green-700' : trendType === 'down' ? 'text-red-700' : 'text-gray-600')}`}>
                  {trend}
                </span>
              </>
            )}
            {subLabel && !trend && (
              <span className="text-[11px] font-medium text-gray-400">{subLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
