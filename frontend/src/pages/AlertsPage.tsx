import { useState } from 'react';
import { Bell, Search, AlertTriangle, CheckCircle, Clock, Bot } from 'lucide-react';
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
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.facilityName.toLowerCase().includes(search.toLowerCase());
    return matchSeverity && matchStatus && matchSearch;
  });

  const counts = {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'Active').length,
    critical: alerts.filter(a => a.severity === 'Critical' && a.status === 'Active').length,
  };

  const handleMarkReviewed = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Resolved' as AlertStatus } : a));
    setSelectedAlert(null);
    showToast('success', 'Alert marked as reviewed', 'The alert status has been updated.');
  };

  const severityIcon = (s: AlertSeverity) => {
    if (s === 'Critical') return <AlertTriangle size={16} className="text-red-500" />;
    if (s === 'High') return <AlertTriangle size={16} className="text-orange-500" />;
    return <Bell size={16} className="text-amber-500" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">Alert Center</h1>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{counts.active} Active</span>
          </div>
          <p className="text-sm text-gray-500">{counts.critical} critical alerts require immediate attention.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Alerts', value: counts.total, color: 'text-gray-900' },
          { label: 'Active', value: counts.active, color: 'text-red-600' },
          { label: 'Critical', value: counts.critical, color: 'text-red-700' },
        ].map(s => (
          <Card key={s.label} padding="sm" className="text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Severity tabs */}
      <div className="flex flex-wrap gap-2">
        {SEVERITY_TABS.map(s => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              severityFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s} {s !== 'All' && <span className="ml-1 opacity-60">({alerts.filter(a => a.severity === s).length})</span>}
          </button>
        ))}

        {/* Status filter & Search */}
        <div className="ml-auto flex gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AlertStatus | 'All')}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Alert list */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={24} />}
            title="No alerts match your filters."
            description="No critical alerts currently require review."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(alert => (
              <div
                key={alert.id}
                className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex-shrink-0 mt-0.5">{severityIcon(alert.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">{alert.type}</span>
                    <StatusBadge status={alert.status} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{alert.title}</p>
                  <p className="text-xs text-gray-500 truncate">{alert.facilityName} — {alert.district}, {alert.state}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={10} className="text-gray-300" />
                    <span className="text-[10px] text-gray-400">{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); handleMarkReviewed(alert.id); }}
                    disabled={alert.status === 'Resolved'}
                    className="text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Mark Reviewed
                  </button>
                  <button className="text-xs font-medium text-blue-600 hover:text-blue-800">Review</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Alert detail modal */}
      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
        size="lg"
        footer={
          <>
            <button onClick={() => setSelectedAlert(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Close</button>
            {selectedAlert?.status !== 'Resolved' && (
              <button
                onClick={() => selectedAlert && handleMarkReviewed(selectedAlert.id)}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Mark Reviewed
              </button>
            )}
          </>
        }
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity={selectedAlert.severity} />
              <StatusBadge status={selectedAlert.status} />
              <span className="text-xs border border-gray-200 px-2 py-0.5 rounded text-gray-500">{selectedAlert.type}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900">{selectedAlert.title}</h3>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p><strong>Facility:</strong> {selectedAlert.facilityName}</p>
              <p><strong>Location:</strong> {selectedAlert.district}, {selectedAlert.state}</p>
              <p><strong>Created:</strong> {new Date(selectedAlert.createdAt).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-600">{selectedAlert.description}</p>
            </div>
            {selectedAlert.aiExplanation && (
              <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-teal-600" />
                  <span className="text-xs font-semibold text-teal-700">AI Decision Support</span>
                  <span className="text-[10px] text-teal-500">— Not an autonomous decision</span>
                </div>
                <p className="text-xs text-teal-700">{selectedAlert.aiExplanation}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
