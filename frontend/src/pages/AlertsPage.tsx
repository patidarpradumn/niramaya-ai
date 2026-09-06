import { useState } from 'react';
import { 
  Bell, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Bot, 
  MapPin, 
  Check, 
  ArrowRight,
  ShieldAlert,
  Flame,
  AlertCircle,
  Building2
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { mockAlerts } from '../services/mock/mockAlerts';
import type { Alert, AlertSeverity, AlertStatus } from '../types';

const SEVERITY_TABS: (AlertSeverity | 'All')[] = ['All', 'Critical', 'High', 'Medium', 'Low'];

export default function AlertsPage() {
  const { showToast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alerts, setAlerts] = useState(mockAlerts);

  const filtered = alerts.filter(a => {
    const matchSeverity = severityFilter === 'All' || a.severity === severityFilter;
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchSearch = !search || 
      a.title.toLowerCase().includes(search.toLowerCase()) || 
      a.facilityName.toLowerCase().includes(search.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(search.toLowerCase()));
    return matchSeverity && matchStatus && matchSearch;
  });

  const counts = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'Active').length,
    critical: alerts.filter(a => a.severity === 'Critical' && a.status === 'Active').length,
    resolved: alerts.filter(a => a.status === 'Resolved').length,
  };

  const handleMarkReviewed = (alertId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Resolved' as AlertStatus } : a));
    if (selectedAlert?.id === alertId) {
      setSelectedAlert(prev => prev ? { ...prev, status: 'Resolved' as AlertStatus } : null);
    }
    showToast('success', 'Alert marked as reviewed', 'The alert status has been resolved.');
  };

  const getSeverityBorder = (severity: AlertSeverity) => {
    switch (severity) {
      case 'Critical':
        return 'border border-red-200/80 bg-gradient-to-b from-red-50/20 via-white to-white hover:border-red-300';
      case 'High':
        return 'border border-orange-200/80 bg-gradient-to-b from-orange-50/20 via-white to-white hover:border-orange-300';
      case 'Medium':
        return 'border border-amber-200/80 bg-gradient-to-b from-amber-50/20 via-white to-white hover:border-amber-300';
      case 'Low':
        return 'border border-blue-200/80 bg-gradient-to-b from-blue-50/20 via-white to-white hover:border-blue-300';
      default:
        return 'border border-slate-200/80 bg-white hover:border-slate-300';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'Critical':
        return <Flame size={16} className="text-red-500" />;
      case 'High':
        return <AlertTriangle size={16} className="text-orange-500" />;
      case 'Medium':
        return <AlertCircle size={16} className="text-amber-500" />;
      default:
        return <Bell size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alert Center</h1>
                <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                  {counts.active} Active
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time stockout, anomaly, and replenishment alerts across facilities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm" className="bg-gradient-to-br from-white to-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Alerts</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{counts.total}</p>
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
              <Bell size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-red-50/50 to-white border border-red-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Critical Active</p>
              <p className="text-2xl font-black text-red-600 mt-0.5">{counts.critical}</p>
            </div>
            <div className="p-2.5 bg-red-100/80 rounded-xl text-red-600">
              <Flame size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Needs Action</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{counts.active}</p>
            </div>
            <div className="p-2.5 bg-amber-100/80 rounded-xl text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Resolved</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{counts.resolved}</p>
            </div>
            <div className="p-2.5 bg-emerald-100/80 rounded-xl text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Controls & Filtering Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs">
        {/* Severity Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SEVERITY_TABS.map(s => {
            const count = s === 'All' ? alerts.length : alerts.filter(a => a.severity === s).length;
            const isSelected = severityFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <span>{s}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Dropdown and Search */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AlertStatus | 'All')}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search alert, facility..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
            />
          </div>
        </div>
      </div>

      {/* ALERTS GRID */}
      {filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <EmptyState
            icon={<CheckCircle2 size={32} className="text-emerald-500" />}
            title="No alerts match your filter criteria"
            description="All systems are operating normally or try changing severity / status filters."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(alert => (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 relative overflow-hidden ${getSeverityBorder(alert.severity)}`}
            >
              {/* Card Header: Badges & Type */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    {alert.type}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-1.5 flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">{getSeverityIcon(alert.severity)}</span>
                  <span>{alert.title}</span>
                </h3>

                {/* Facility & Location Info */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                    <Building2 size={12} className="text-gray-400 shrink-0" />
                    <span className="truncate">{alert.facilityName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <MapPin size={11} className="text-gray-400 shrink-0" />
                    <span className="truncate">{alert.district}, {alert.state}</span>
                  </div>
                </div>

                {/* Description Snippet */}
                {alert.description && (
                  <p className="text-xs text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 mb-3 leading-relaxed">
                    {alert.description}
                  </p>
                )}

                {/* AI Explanation Tag if exists */}
                {alert.aiExplanation && (
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-700 bg-teal-50 border border-teal-100/80 px-2.5 py-1 rounded-lg mb-3">
                    <Bot size={13} className="text-teal-600 shrink-0" />
                    <span className="truncate font-medium">AI Decision Insight Available</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Timestamp & Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock size={11} />
                  <span>{new Date(alert.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {alert.status !== 'Resolved' && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkReviewed(alert.id, e)}
                      title="Mark as Resolved"
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200/60"
                    >
                      <Check size={12} />
                      <span>Resolve</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>Details</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert Detail Modal */}
      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details & Decision Support"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400">
              ID: {selectedAlert?.id}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedAlert(null)} 
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
              {selectedAlert?.status !== 'Resolved' && (
                <button
                  onClick={() => selectedAlert && handleMarkReviewed(selectedAlert.id)}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Mark as Resolved</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedAlert.severity} />
                <StatusBadge status={selectedAlert.status} />
                <span className="text-xs font-semibold border border-gray-200 px-2 py-0.5 rounded-lg text-gray-600 bg-gray-50">
                  {selectedAlert.type}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                <span>{new Date(selectedAlert.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 leading-snug flex items-start gap-2">
              <span className="mt-1">{getSeverityIcon(selectedAlert.severity)}</span>
              <span>{selectedAlert.title}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Facility</p>
                <p className="font-bold text-slate-800 mt-0.5">{selectedAlert.facilityName}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Jurisdiction</p>
                <p className="font-bold text-slate-800 mt-0.5">{selectedAlert.district}, {selectedAlert.state}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Description</h4>
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/70 text-xs text-gray-700 leading-relaxed">
                {selectedAlert.description}
              </div>
            </div>

            {selectedAlert.aiExplanation && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 mb-1.5 flex items-center gap-1.5">
                  <Bot size={14} className="text-teal-600" />
                  <span>AI Decision Support Explanation</span>
                </h4>
                <div className="bg-gradient-to-br from-teal-50 to-teal-50/30 border border-teal-200/80 rounded-xl p-3.5 space-y-2">
                  <p className="text-xs text-teal-900 leading-relaxed">{selectedAlert.aiExplanation}</p>
                  <p className="text-[10px] text-teal-600 font-medium pt-1 border-t border-teal-100">
                    ℹ️ Automated decision support insights require administrative verification prior to redistribution or order changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
