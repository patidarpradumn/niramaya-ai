import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, Search, X, CheckCircle2,
  Building2, Package, Sparkles, ArrowUpDown, ChevronLeft,
  ChevronRight, Loader2, ArrowRight, Check
} from 'lucide-react';
import { alertsAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { severityColor, timeAgo, capitalize } from '../utils';
import type { Alert, AIExplainResponse } from '../types';

const riskCategoryLabels: Record<string, { label: string; badge: string }> = {
  STOCK_OUT: { label: 'Predicted Shortage Risk', badge: 'bg-red-100 text-red-800 border-red-200' },
  EXPIRY: { label: 'Expiry Risk', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  EQUIPMENT: { label: 'Equipment Risk', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  RESOURCE: { label: 'Resource Allocation', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
};

export default function Alerts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';

  const canManageAlerts = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(roleLower);

  // Filters State
  const [severity, setSeverity] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [facilityId, setFacilityId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'severity' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Alerts Data State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  // Inline Quick Gemini Explain Modal
  const [explainModalAlert, setExplainModalAlert] = useState<Alert | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AIExplainResponse | null>(null);
  const [explainError, setExplainError] = useState('');

  useEffect(() => {
    loadAlerts();
  }, [severity, status, category, facilityId, searchQuery]);

  const loadAlerts = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = {
        limit: 200,
      };
      if (severity) params.severity = severity;
      if (status) params.status = status;
      if (category) params.risk_category = category;
      if (facilityId.trim()) params.facility_id = Number(facilityId.trim());

      const response = await alertsAPI.list(params);
      setAlerts(response.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load alerts';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    setAcknowledgingId(id);
    try {
      const res = await alertsAPI.acknowledge(id);
      setAlerts(prev => prev.map(al => al.id === id ? res.data : al));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to acknowledge alert');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleQuickExplain = async (al: Alert) => {
    setExplainModalAlert(al);
    setExplanation(null);
    setExplainError('');
    setIsExplaining(true);
    try {
      const res = await aiAPI.explainAlert(al.id);
      setExplanation(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Gemini AI explanation failed';
      setExplainError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsExplaining(false);
    }
  };

  // Filter & Sort
  const filteredAlerts = useMemo(() => {
    let result = alerts.filter(al => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = al.title.toLowerCase().includes(q);
        const matchDesc = al.description.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'created_at') {
        comp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'severity') {
        const weights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        comp = (weights[a.severity] || 0) - (weights[b.severity] || 0);
      } else if (sortBy === 'status') {
        comp = a.status.localeCompare(b.status);
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [alerts, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const paginatedAlerts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, page, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Operational Alerts & Risks
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Real-time supply-chain risk detection and AI-assisted mitigation.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Unable to fetch alerts</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadAlerts}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search alert title or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="alerts-search-input"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              data-testid="alerts-severity-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Risk Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              data-testid="alerts-category-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Risk Categories</option>
              <option value="STOCK_OUT">Predicted Shortage</option>
              <option value="EXPIRY">Expiry Risk</option>
              <option value="EQUIPMENT">Equipment Failure</option>
              <option value="RESOURCE">Resource Allocation</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              data-testid="alerts-status-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Sorting and Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Showing <strong className="text-gray-900">{filteredAlerts.length}</strong> alerts
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-none bg-transparent font-semibold text-gray-800 outline-none cursor-pointer"
            >
              <option value="created_at">Timestamp</option>
              <option value="severity">Severity</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-primary hover:underline font-semibold uppercase"
            >
              {sortOrder}
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverity('');
                setStatus('');
                setCategory('');
                setFacilityId('');
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium ml-2"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="card p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-gray-500 text-sm">Monitoring supply chain risks...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-2 border-gray-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <p className="text-gray-800 font-bold text-lg">All Clear — No Active Alerts</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
            No matching risk alerts found under current filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="alerts-list">
          {paginatedAlerts.map((al) => {
            const colors = severityColor(al.severity);
            const catBadge = riskCategoryLabels[al.risk_category] || {
              label: al.risk_category,
              badge: 'bg-gray-100 text-gray-800 border-gray-200',
            };
            const details = al.details || {};

            return (
              <div
                key={al.id}
                className="card bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start justify-between gap-4 group"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-xl ${colors} shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
                    <Bell className="w-5 h-5" />
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Header tags */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${colors}`}
                        data-testid="severity-badge"
                      >
                        {al.severity}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${catBadge.badge}`}
                        data-testid="risk-category-badge"
                      >
                        {catBadge.label}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          al.status === 'ACTIVE'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : al.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                        data-testid="status-badge"
                      >
                        {capitalize(al.status)}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto font-mono">
                        {timeAgo(al.created_at)}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary transition-colors">
                        {al.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{al.description}</p>
                    </div>

                    {/* Metadata Context Badges */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        Facility #{al.facility_id}
                      </span>
                      {al.item_id && (
                        <span className="flex items-center gap-1 font-mono">
                          <Package className="w-3.5 h-3.5 text-gray-400" />
                          Item #{al.item_id}
                        </span>
                      )}
                      {details.current_stock !== undefined && (
                        <span className="text-gray-700 font-mono font-medium">
                          Stock: {String(details.current_stock)}
                        </span>
                      )}
                      {details.days_to_stockout !== undefined && (
                        <span className="text-red-700 font-semibold">
                          Shortage in ~{String(details.days_to_stockout)}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 justify-between sm:justify-start">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickExplain(al)}
                      data-testid={`explain-btn-${al.id}`}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Explain with Gemini AI"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Explain
                    </button>

                    {!al.acknowledged && al.status === 'ACTIVE' && canManageAlerts && (
                      <button
                        onClick={() => handleAcknowledge(al.id)}
                        disabled={acknowledgingId === al.id}
                        data-testid={`ack-btn-${al.id}`}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 font-medium"
                      >
                        {acknowledgingId === al.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Ack
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => navigate(`/alerts/${al.id}`)}
                    data-testid={`view-alert-${al.id}`}
                    className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline flex items-center gap-1 mt-1"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredAlerts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              data-testid="alerts-page-size"
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="alerts-prev-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs font-semibold px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="alerts-next-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* QUICK EXPLAIN MODAL */}
      {explainModalAlert && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">
                    Gemini AI Alert Explanation
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Alert #{explainModalAlert.id} · {explainModalAlert.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExplainModalAlert(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {isExplaining ? (
                <div className="p-8 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-xs text-gray-500">Synthesizing supply chain context...</p>
                </div>
              ) : explainError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {explainError}
                </div>
              ) : explanation ? (
                <div className="space-y-3" data-testid="quick-gemini-output">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-800 leading-relaxed whitespace-pre-line">
                    {explanation.explanation}
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                    <strong>Notice:</strong> {explanation.disclaimer || 'Predictions and AI analysis provide probabilistic estimates for decision support. Not guaranteed.'}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  const id = explainModalAlert.id;
                  setExplainModalAlert(null);
                  navigate(`/alerts/${id}`);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Open Full Detail Page →
              </button>
              <button
                onClick={() => setExplainModalAlert(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}