import { useState, useEffect, type ReactNode } from 'react';
import {
  Building2, AlertTriangle, TrendingDown, Calendar, ArrowLeftRight, Wrench,
  Filter, Zap, Clock, Bot, CheckCircle2, Info, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { StatusBadge, ConfidenceBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/LoadingScreen';
import {
  mockDashboardMetrics, mockStockRiskData, mockStockRisk30D, mockStockRisk90D,
  mockRiskDistribution, mockAISynthesis, mockAuditEvents
} from '../services/mock/mockData';
import { mockAlerts } from '../services/mock/mockAlerts';

const PERIOD_MAP: Record<string, typeof mockStockRiskData> = {
  '7D': mockStockRiskData,
  '30D': mockStockRisk30D,
  '90D': mockStockRisk90D,
};

const DONUT_COLORS = ['#DC2626', '#B45309', '#2563EB'];

const AUDIT_ICONS: Record<string, ReactNode> = {
  prediction: <Bot size={14} className="text-teal-500" />,
  alert: <AlertTriangle size={14} className="text-red-500" />,
  transfer: <ArrowLeftRight size={14} className="text-blue-500" />,
  review: <Info size={14} className="text-gray-500" />,
  approval: <CheckCircle2 size={14} className="text-green-500" />,
  system: <Zap size={14} className="text-amber-500" />,
};

function NetworkVisualization() {
  const nodes = [
    { id: 'state', x: 50, y: 15, label: 'Maharashtra', status: 'stable', size: 8 },
    { id: 'd1', x: 20, y: 45, label: 'Mumbai', status: 'critical', size: 6 },
    { id: 'd2', x: 50, y: 45, label: 'Pune', status: 'moderate', size: 6 },
    { id: 'd3', x: 80, y: 45, label: 'Nagpur', status: 'critical', size: 6 },
    { id: 'f1', x: 10, y: 75, label: 'KEM', status: 'critical', size: 4 },
    { id: 'f2', x: 25, y: 75, label: 'Sion', status: 'moderate', size: 4 },
    { id: 'f3', x: 45, y: 75, label: 'Pune DH', status: 'moderate', size: 4 },
    { id: 'f4', x: 60, y: 75, label: 'NRC', status: 'stable', size: 4 },
    { id: 'f5', x: 75, y: 75, label: 'NCI', status: 'critical', size: 4 },
    { id: 'f6', x: 90, y: 75, label: 'AUH', status: 'moderate', size: 4 },
  ];

  const connections = [
    ['state', 'd1'], ['state', 'd2'], ['state', 'd3'],
    ['d1', 'f1'], ['d1', 'f2'], ['d2', 'f3'], ['d2', 'f4'], ['d3', 'f5'], ['d3', 'f6'],
  ];

  const statusColors: Record<string, string> = {
    critical: '#DC2626', moderate: '#F59E0B', stable: '#22C55E',
  };

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <svg viewBox="0 0 100 90" className="w-full h-40" aria-label="Healthcare Network Visualization">
      {/* Connection lines */}
      {connections.map(([from, to]) => {
        const a = nodeMap[from], b = nodeMap[to];
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="2 1"
          />
        );
      })}
      {/* Nodes */}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.size + 2} fill={statusColors[n.status]} opacity="0.15" />
          <circle cx={n.x} cy={n.y} r={n.size} fill={statusColors[n.status]} />
          <text x={n.x} y={n.y + n.size + 4} textAnchor="middle" fontSize="3.5" fill="#6B7280" className="select-none">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}: <strong>{p.value}%</strong></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<'7D' | '30D' | '90D'>('7D');
  const [isLoading, setIsLoading] = useState(true);
  const [metrics] = useState(mockDashboardMetrics);
  const criticalAlerts = mockAlerts.filter(a => a.status === 'Active').slice(0, 4);
  const chartData = PERIOD_MAP[period];

  const donutData = [
    { name: 'Critical Shortage', value: mockRiskDistribution.criticalShortage },
    { name: 'Near Expiry', value: mockRiskDistribution.nearExpiry },
    { name: 'Logistics Delay', value: mockRiskDistribution.logisticsDelay },
  ];

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <StatusBadge status="Live Telemetry" />
              <span className="text-xs text-gray-400">Updated {metrics.lastUpdated}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">National Health Command</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Filter size={14} />}>Filter State</Button>
          <Button variant="primary" size="sm" leftIcon={<Zap size={14} />}>Run Diagnostics</Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard
          label="Total Facilities"
          value={metrics.totalFacilities.toLocaleString()}
          icon={<Building2 size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          trend={`+${metrics.facilitiesOnline - metrics.totalFacilities + 12} online`}
          trendType="up"
        />
        <MetricCard
          label="Critical Alerts"
          value={metrics.criticalAlerts}
          icon={<AlertTriangle size={18} className="text-red-600" />}
          iconBg="bg-red-50"
          valueColor="text-red-600"
          subLabel="! Action required"
        />
        <MetricCard
          label="Predicted Shortages"
          value={metrics.predictedShortages}
          icon={<TrendingDown size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          subLabel="Next 7 days"
        />
        <MetricCard
          label="Expiry Risks"
          value={metrics.expiryRisks}
          icon={<Calendar size={18} className="text-orange-600" />}
          iconBg="bg-orange-50"
          subLabel="Batches <30d"
        />
        <MetricCard
          label="Redistribution"
          value={metrics.redistributionOpportunities}
          icon={<ArrowLeftRight size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          subLabel="Ready to dispatch"
        />
        <MetricCard
          label="Equipment Issues"
          value={metrics.equipmentIssues}
          icon={<Wrench size={18} className="text-gray-600" />}
          iconBg="bg-gray-50"
          subLabel="Requires review"
        />
      </div>

      {/* AI Command Intel banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl p-4 lg:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <Bot size={20} className="text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold tracking-widest text-blue-200 uppercase">NIRAMAYA AI COMMAND INTEL</span>
              {mockAISynthesis.confidence && <ConfidenceBadge confidence={mockAISynthesis.confidence} />}
            </div>
          </div>
        </div>
        <p className="flex-1 text-sm text-blue-100 leading-relaxed">
          Critical oxygen supply depletion projected in Sector 4 district hospitals within 36 hours due to surge in respiratory admissions. Automated redistribution protocol from Central Warehouse B is pre-calculated and optimized.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            Review Plan
          </Button>
          <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            Authorize Transfer
          </Button>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Stock Risk Trend */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Stock Risk Trend</h2>
              <p className="text-xs text-gray-400">30-day projection across critical pharmaceutical supplies</p>
            </div>
            <div className="flex gap-1">
              {(['7D', '30D', '90D'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    period === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 10, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B45309" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#B45309" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={2} fill="url(#actualGrad)" dot={false} />
              <Area type="monotone" dataKey="forecast" name="Forecast" stroke="#B45309" strokeWidth={2} fill="url(#forecastGrad)" strokeDasharray="5 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk Distribution</h2>
          <p className="text-xs text-gray-400 mb-3">Category breakdown of alerts</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                dataKey="value"
              >
                {donutData.map((_, index) => (
                  <Cell key={index} fill={DONUT_COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col items-center -mt-16 mb-2 pointer-events-none">
            <span className="text-2xl font-bold text-gray-900">{mockRiskDistribution.total}</span>
            <span className="text-[10px] text-gray-400 font-medium tracking-wider">TOTAL RISKS</span>
          </div>
          <div className="space-y-1 pt-10">
            {donutData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-xs text-gray-600">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-gray-700">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Healthcare Network Visualization + lower row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Network viz */}
        <Card className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Healthcare Network Intelligence</h2>
          <p className="text-xs text-gray-400 mb-3">State → District → Facility hierarchy</p>
          <NetworkVisualization />
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
            {[['#DC2626', 'Critical'], ['#F59E0B', 'Moderate'], ['#22C55E', 'Stable']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-gray-500">{l}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Critical Attention Feed */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Critical Attention Feed</h2>
              <p className="text-xs text-gray-400">Requires immediate administrative review</p>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {metrics.criticalAlerts} Active
            </span>
          </div>
          <div className="space-y-2">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                <AlertCircle size={14} className={alert.severity === 'Critical' ? 'text-red-500 mt-0.5 flex-shrink-0' : 'text-amber-500 mt-0.5 flex-shrink-0'} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{alert.title}</p>
                  <p className="text-[10px] text-gray-400 truncate">{alert.facilityName}</p>
                </div>
                <button className="text-[10px] text-blue-600 font-medium hover:underline flex-shrink-0">Review</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Operational Timeline */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Operational Timeline</h2>
              <p className="text-xs text-gray-400">Real-time national supply chain audit log</p>
            </div>
            <button className="text-[11px] text-blue-600 font-medium hover:underline">View All Logs</button>
          </div>
          <div className="space-y-3">
            {mockAuditEvents.slice(0, 5).map((event, i) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    {AUDIT_ICONS[event.type]}
                  </div>
                  {i < 4 && <div className="w-px flex-1 bg-gray-100 mt-1" style={{ minHeight: 16 }} />}
                </div>
                <div className="pb-3 flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{event.event}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-gray-300" />
                    <span className="text-[10px] text-gray-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[10px] text-gray-400 truncate">• {event.actor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
