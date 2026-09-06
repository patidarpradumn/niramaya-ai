// Status Badge, Risk Badge, Confidence Badge
import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'critical' | 'high' | 'medium' | 'low' | 'stable' | 'healthy' | 'warning' | 'info' | 'neutral' | 'ai';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  stable: 'bg-blue-50 text-blue-700 border-blue-200',
  healthy: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
  ai: 'bg-teal-50 text-teal-700 border-teal-200',
};

const dotColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
  stable: 'bg-blue-500',
  healthy: 'bg-green-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  neutral: 'bg-gray-400',
  ai: 'bg-teal-500',
};

export function Badge({ children, variant = 'neutral', size = 'md', dot = false }: BadgeProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium border rounded-full';
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`${base} ${sizeClass} ${variantStyles[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// Specialized severity badge
export function SeverityBadge({ severity }: { severity: 'Critical' | 'High' | 'Medium' | 'Low' }) {
  const map: Record<string, BadgeProps['variant']> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };
  return <Badge variant={map[severity]} dot>{severity}</Badge>;
}

// Specialized status badge
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    'Critical Risk': 'critical',
    'Moderate': 'warning',
    'Stable': 'stable',
    'Operational': 'healthy',
    'Active': 'critical',
    'Under Review': 'medium',
    'Resolved': 'healthy',
    'Pending Review': 'warning',
    'Approved': 'healthy',
    'Rejected': 'critical',
    'Modified': 'info',
    'Maintenance Due': 'warning',
    'Issue Detected': 'high',
    'Critical': 'critical',
    'Healthy': 'healthy',
    'Elevated Risk': 'high',
    'Live Telemetry': 'ai',
    'Model Active': 'ai',
  };
  return <Badge variant={map[status] || 'neutral'} dot>{status}</Badge>;
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {confidence.toFixed(1)}% Confidence
    </span>
  );
}
