import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Package, AlertTriangle, TrendingUp, ArrowRight,
  CheckCircle, XCircle, AlertCircle, Info, Loader2, RefreshCw,
  Clock, ShieldAlert, ArrowLeftRight, Wrench, FileCheck, Layers
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { dashboardAPI, recommendationsAPI, equipmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo, severityColor, formatRole, formatDate } from '../utils';
import type {
  DashboardSummary, DashboardStockRisk, DashboardExpiryRisk,
  Recommendation, Equipment, AlertSeverity
} from '../types';

const severityIcon: Record<AlertSeverity, React.ElementType> = {
  critical: XCircle,
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};

const stockColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'];

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stockRisks, setStockRisks] = useState<DashboardStockRisk[]>([]);
  const [expiryRisks, setExpiryRisks] = useState<DashboardExpiryRisk[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, stockRisksRes, expiryRisksRes, recsRes, equipRes] = await Promise.all([
        dashboardAPI.getSummary().catch(() => ({ data: null })),
        dashboardAPI.getStockRisks().catch(() => ({ data: [] })),
        dashboardAPI.getExpiryRisks().catch(() => ({ data: [] })),
        recommendationsAPI.list({ limit: 10 }).catch(() => ({ data: [] })),
        equipmentAPI.list({ limit: 50 }).catch(() => ({ data: [] })),
      ]);

      if (!summaryRes.data) {
        setError('Failed to fetch complete dashboard data. Please try again.');
      } else {
        setSummary(summaryRes.data);
      }
      setStockRisks(stockRisksRes.data || []);
      setExpiryRisks(expiryRisksRes.data || []);
      setRecommendations(recsRes.data || []);
      setEquipment(equipRes.data || []);
    } catch {
      setError('Failed to fetch complete dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" data-testid="dashboard-loading">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-text-secondary font-medium">Loading Niramaya AI Admin Dashboard...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto my-12" data-testid="dashboard-error">
        <AlertTriangle className="w-12 h-12 text-error mx-auto mb-3" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Error Loading Dashboard</h2>
        <p className="text-text-secondary text-sm mb-6">{error || 'Unable to retrieve government dashboard metrics.'}</p>
        <button onClick={fetchDashboardData} className="btn-primary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // Calculate Metrics / KPIs dynamically
  const pendingRecsCount = recommendations.filter((r) => r.status === 'PENDING').length;
  const equipmentIssuesCount = equipment.filter(
    (e) => e.status !== 'OPERATIONAL' || e.is_overdue_maintenance
  ).length;
  const criticalAlertsCount = summary.kpis.critical_alerts;
  const pendingActionsCount = pendingRecsCount + criticalAlertsCount;

  const kpis = [
    {
      label: 'Total Facilities',
      value: summary.kpis.total_facilities,
      icon: Building2,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      label: 'Critical Alerts',
      value: summary.kpis.critical_alerts,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600 border-red-200',
    },
    {
      label: 'Predicted Shortages',
      value: summary.kpis.predicted_demand_count,
      icon: TrendingUp,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    {
      label: 'Expiry Risks',
      value: expiryRisks.length,
      icon: Clock,
      color: 'bg-orange-50 text-orange-600 border-orange-200',
    },
    {
      label: 'Redistribution Ops',
      value: pendingRecsCount,
      icon: ArrowLeftRight,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      label: 'Equipment Issues',
      value: equipmentIssuesCount,
      icon: Wrench,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    {
      label: 'Pending Actions',
      value: pendingActionsCount,
      icon: FileCheck,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    },
  ];

  // Stock status pie chart data
  const stockData = [
    { name: 'Critical', value: summary.stock_summary.critical },
    { name: 'Low', value: summary.stock_summary.low },
    { name: 'Adequate', value: summary.stock_summary.adequate },
    { name: 'Overstocked', value: summary.stock_summary.overstocked },
  ];

  // Prepare Stock-Risk chart data (top 8)
  const stockChartData = stockRisks.slice(0, 8).map((risk) => ({
    item: risk.item_name.length > 12 ? `${risk.item_name.substring(0, 10)}…` : risk.item_name,
    fullName: risk.item_name,
    facility: risk.facility_name,
    Stock: risk.current_stock,
    MinThreshold: risk.min_threshold,
  }));

  // Role-specific dashboard configuration
  const roleNorm = (user?.role || '').toLowerCase();
  let dashboardTitle = 'Government Operations Dashboard';
  let dashboardSubtitle = 'Real-time supply chain monitoring, risk analysis & decision support';

  if (roleNorm === 'super_admin') {
    dashboardTitle = 'National Health Command Center (Super Admin)';
    dashboardSubtitle = 'Nationwide healthcare inventory intelligence, cross-facility supply balancing & risk alerts';
  } else if (roleNorm === 'state_admin') {
    dashboardTitle = 'State Healthcare Operations Command';
    dashboardSubtitle = 'Statewide facility oversight, district-level medicine reserves & emergency response';
  } else if (roleNorm === 'district_admin') {
    dashboardTitle = 'District Health Administration Dashboard';
    dashboardSubtitle = 'District healthcare facilities, local drug distribution & stockout management';
  } else if (roleNorm === 'hospital_admin') {
    dashboardTitle = 'Hospital Facility Command Center';
    dashboardSubtitle = 'Hospital inventory levels, batch expiry tracking, equipment downtime & clinical supply';
  } else if (roleNorm === 'facility_staff') {
    dashboardTitle = 'Facility Staff Operations Dashboard';
    dashboardSubtitle = 'Daily medicine consumption logging, low-stock warnings & local medical equipment';
  } else if (roleNorm === 'citizen') {
    dashboardTitle = 'Public Health & Medicine Availability Portal';
    dashboardSubtitle = 'Find nearby healthcare facilities, verified medicine stocks & public health intelligence';
  }

  // User Jurisdiction Scope Label
  const scopeLabel = user?.role
    ? formatRole(user.role) +
      (user.state_id ? ` · State ID ${user.state_id}` : '') +
      (user.district_id ? ` · District ID ${user.district_id}` : '') +
      (user.facility_id ? ` · Facility ID ${user.facility_id}` : '')
    : 'Government Scope';

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-dashboard">
      {/* Header & Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
          </div>
          <p className="text-blue-200/70 text-sm mt-1">{dashboardSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-xs font-medium self-start sm:self-auto">
          <Layers className="w-4 h-4 text-primary-light" />
          <span>{scopeLabel}</span>
        </div>
      </div>

      {/* 7 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4" data-testid="kpi-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card p-4 flex flex-col justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">{kpi.label}</span>
                <div className={`p-2 rounded-lg border ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Distribution & Stock-Risk Chart (2 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution (Pie/Donut Chart) */}
        <div className="card" data-testid="risk-distribution-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Stock Risk Distribution</h3>
              <p className="text-xs text-text-secondary">Categorization of facility inventory status</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stockData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={stockColors[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} items`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
            {stockData.map((item, index) => (
              <div key={item.name} className="text-center p-2 rounded-lg bg-gray-50">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stockColors[index] }} />
                  <span className="text-xs text-text-secondary">{item.name}</span>
                </div>
                <p className="font-semibold text-sm text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stock-Risk Chart (Recharts BarChart) */}
        <div className="card" data-testid="stock-risk-chart-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Stock-Out Risk Comparison</h3>
              <p className="text-xs text-text-secondary">Current Stock vs Minimum Threshold (Top At-Risk Items)</p>
            </div>
          </div>
          {stockChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CheckCircle className="w-10 h-10 text-success mb-2 opacity-60" />
              <p className="text-text-primary font-medium">No High Stock-Out Risks</p>
              <p className="text-text-secondary text-xs mt-1">All inventory items are currently above minimum safety thresholds.</p>
            </div>
          ) : (
            <div className="h-64" data-testid="stock-risk-recharts">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="item" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(val: number, name: string) => [val, name === 'Stock' ? 'Current Stock' : 'Min Threshold']}
                    labelFormatter={(labelValue: string, payload: readonly any[]) => payload?.[0]?.payload?.fullName || labelValue}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Stock" fill="#EF4444" radius={[4, 4, 0, 0]} name="Current Stock" />
                  <Bar dataKey="MinThreshold" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Min Threshold" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Expiry Risk List & Recent Recommendations (2 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry Risk List */}
        <div className="card" data-testid="expiry-risk-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-text-primary">Expiry Risk Items</h3>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
              {expiryRisks.length} at risk
            </span>
          </div>

          {expiryRisks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-2 opacity-60" />
              <p className="text-text-primary font-medium text-sm">No Expiring Batches</p>
              <p className="text-text-secondary text-xs mt-1">No supplies are expiring within the next 90 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto pr-1">
              {expiryRisks.map((risk) => (
                <div key={risk.inventory_id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-text-primary truncate">{risk.item_name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{risk.facility_name} · Qty: {risk.quantity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        risk.days_to_expiry <= 15
                          ? 'bg-red-100 text-red-700'
                          : risk.days_to_expiry <= 30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {risk.days_to_expiry === 0 ? 'Expires Today' : `${risk.days_to_expiry} days left`}
                    </span>
                    <p className="text-[10px] text-text-secondary mt-1">{formatDate(risk.expiry_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Recommendations */}
        <div className="card" data-testid="recommendations-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-text-primary">Redistribution Recommendations</h3>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              {pendingRecsCount} Pending
            </span>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-text-secondary mx-auto mb-2 opacity-40" />
              <p className="text-text-primary font-medium text-sm">No Recommendations Found</p>
              <p className="text-text-secondary text-xs mt-1">Cross-facility stock balance is optimal across all locations.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {recommendations.slice(0, 5).map((rec) => (
                <div key={rec.id} className="p-3.5 rounded-xl bg-gray-50 border border-border/60 hover:bg-white hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-text-primary">{rec.title || `Transfer ${rec.suggested_quantity ?? ''} ${rec.item_name || 'Supplies'}`}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        <span className="font-medium text-text-primary">{rec.source_facility_name || 'Source'}</span> →{' '}
                        <span className="font-medium text-text-primary">{rec.destination_facility_name || 'Destination'}</span>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        rec.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : rec.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                  {rec.reasoning && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2 italic bg-white p-2 rounded border border-gray-100">
                      "{rec.reasoning}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Critical Alerts Section */}
      <div className="card" data-testid="critical-alerts-section">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-text-primary">Critical & High Priority Alerts</h3>
          </div>
          <Link to="/alerts" className="text-primary hover:text-primary-dark flex items-center gap-1 text-xs font-semibold">
            View All Alerts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {summary.recent_alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-2 opacity-60" />
            <p className="text-text-primary font-medium text-sm">All Clear!</p>
            <p className="text-text-secondary text-xs mt-0.5">No critical or high severity active alerts registered.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.recent_alerts.slice(0, 6).map((alert) => {
              const Icon = severityIcon[alert.severity] || Info;
              const colorClasses = severityColor(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${colorClasses.split(' ')[0]} border-current/10`}
                >
                  <Icon className={`w-5 h-5 ${colorClasses.split(' ')[1]} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-text-primary truncate">{alert.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${colorClasses}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {alert.facility_name} · {timeAgo(alert.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}