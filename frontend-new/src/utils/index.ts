import type { UserRole } from '../types';

/** Normalize role string to lowercase standard format */
export function normalizeRole(role?: string): string {
  return (role || '').toLowerCase();
}

/** Admin-level roles that can access administrative features */
export function isAdmin(role?: UserRole | string): boolean {
  const norm = normalizeRole(role);
  return ['super_admin', 'state_admin', 'district_admin', 'hospital_admin'].includes(norm);
}

/** Roles that can manage inventory and stock */
export function isStaff(role?: UserRole | string): boolean {
  const norm = normalizeRole(role);
  return ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(norm);
}

/** Check if a role is citizen */
export function isCitizen(role?: UserRole | string): boolean {
  return normalizeRole(role) === 'citizen';
}

/** Check if role has access to audit logs (admin only) */
export function canViewAuditLogs(role?: UserRole | string): boolean {
  const norm = normalizeRole(role);
  return ['super_admin', 'state_admin', 'district_admin'].includes(norm);
}

/** Check if user's role is permitted against a list of allowed roles */
export function hasRoleAccess(userRole?: UserRole | string, allowedRoles?: (UserRole | string)[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  const normUser = normalizeRole(userRole);
  return allowedRoles.some((r) => normalizeRole(r) === normUser);
}

/** Format a date string for display */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format a datetime string for display */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a relative time (e.g., "2 hours ago") */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

/** Capitalize first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Format role for display */
export function formatRole(role?: UserRole | string): string {
  if (!role) return 'Citizen';
  return role.toLowerCase().split('_').map(capitalize).join(' ');
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '…';
}

/** Extract error message from API error */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response;
    if (resp?.data?.detail) {
      return typeof resp.data.detail === 'string'
        ? resp.data.detail
        : JSON.stringify(resp.data.detail);
    }
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

/** Get stock level badge color classes */
export function stockLevelColor(level: string): string {
  switch (level) {
    case 'critical': return 'bg-red-100 text-red-700';
    case 'low': return 'bg-amber-100 text-amber-700';
    case 'adequate': return 'bg-emerald-100 text-emerald-700';
    case 'overstocked': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

/** Get severity badge color classes */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700';
    case 'high': return 'bg-orange-100 text-orange-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    case 'low': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

/** Get equipment status badge color classes */
export function equipmentStatusColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'OPERATIONAL': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'UNDER_MAINTENANCE': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'NON_FUNCTIONAL': return 'bg-red-100 text-red-800 border-red-200';
    case 'RETIRED': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
