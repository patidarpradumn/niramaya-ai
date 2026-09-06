import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight, CheckCircle2, XCircle, Edit3, Search,
  Building2, Package, Clock, Sparkles, AlertTriangle,
  ChevronLeft, ChevronRight, Loader2, Info,
  ShieldCheck, RefreshCw, Check, ShieldAlert
} from 'lucide-react';
import { recommendationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, timeAgo } from '../utils';
import type { Recommendation } from '../types';

export default function Recommendations() {
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';
  const canManage = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(roleLower);

  // Filter and Search States
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [facilityIdFilter, setFacilityIdFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'suggested_quantity' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Recommendations Data
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Action Modals State
  const [approvingRec, setApprovingRec] = useState<Recommendation | null>(null);
  const [overrideQuantity, setOverrideQuantity] = useState<number | ''>('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const [rejectingRec, setRejectingRec] = useState<Recommendation | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  const [modifyingRec, setModifyingRec] = useState<Recommendation | null>(null);
  const [modifyQuantity, setModifyQuantity] = useState<number | ''>('');
  const [modifyReasoning, setModifyReasoning] = useState('');
  const [modifyNotes, setModifyNotes] = useState('');
  const [isSubmittingModify, setIsSubmittingModify] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [statusFilter, facilityIdFilter]);

  const loadRecommendations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = { limit: 150 };
      if (statusFilter) params.status = statusFilter;
      if (facilityIdFilter.trim()) params.facility_id = Number(facilityIdFilter.trim());

      const res = await recommendationsAPI.list(params);
      setRecommendations(res.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load recommendations';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setIsGenerating(true);
    setActionFeedback(null);
    try {
      const res = await recommendationsAPI.generate({
        facility_id: user?.facility_id || undefined,
      });
      setActionFeedback({
        type: 'success',
        message: `Successfully analyzed inventory networks and generated ${res.data?.length || 0} redistribution recommendation(s).`,
      });
      await loadRecommendations();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to generate recommendations';
      setActionFeedback({ type: 'error', message: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingRec) return;
    setIsSubmittingApproval(true);
    try {
      const payload: any = {};
      if (overrideQuantity && Number(overrideQuantity) > 0) {
        payload.override_quantity = Number(overrideQuantity);
      }
      if (approvalNotes.trim()) {
        payload.notes = approvalNotes.trim();
      }

      const res = await recommendationsAPI.approve(approvingRec.id, payload);
      setRecommendations(prev => prev.map(r => r.id === approvingRec.id ? res.data : r));
      setActionFeedback({
        type: 'success',
        message: `Recommendation #${approvingRec.id} approved successfully. Stock transfer initiated.`,
      });
      setApprovingRec(null);
      setOverrideQuantity('');
      setApprovalNotes('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to approve recommendation';
      setActionFeedback({ type: 'error', message: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRec) return;
    setIsSubmittingRejection(true);
    try {
      const payload: any = {};
      if (rejectionNotes.trim()) {
        payload.notes = rejectionNotes.trim();
      }

      const res = await recommendationsAPI.reject(rejectingRec.id, payload);
      setRecommendations(prev => prev.map(r => r.id === rejectingRec.id ? res.data : r));
      setActionFeedback({
        type: 'success',
        message: `Recommendation #${rejectingRec.id} has been marked as REJECTED.`,
      });
      setRejectingRec(null);
      setRejectionNotes('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to reject recommendation';
      setActionFeedback({ type: 'error', message: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const handleConfirmModify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingRec) return;
    setIsSubmittingModify(true);
    try {
      const payload: any = {};
      if (modifyQuantity && Number(modifyQuantity) > 0) {
        payload.suggested_quantity = Number(modifyQuantity);
      }
      if (modifyReasoning.trim()) {
        payload.reasoning = modifyReasoning.trim();
      }
      if (modifyNotes.trim()) {
        payload.notes = modifyNotes.trim();
      }

      const res = await recommendationsAPI.modify(modifyingRec.id, payload);
      setRecommendations(prev => prev.map(r => r.id === modifyingRec.id ? res.data : r));
      setActionFeedback({
        type: 'success',
        message: `Recommendation #${modifyingRec.id} modified successfully.`,
      });
      setModifyingRec(null);
      setModifyQuantity('');
      setModifyReasoning('');
      setModifyNotes('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to modify recommendation';
      setActionFeedback({ type: 'error', message: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsSubmittingModify(false);
    }
  };

  // Filtered and Sorted list
  const filteredRecs = useMemo(() => {
    let result = recommendations.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchReason = r.reasoning.toLowerCase().includes(q);
        const matchItem = r.item_name?.toLowerCase().includes(q);
        const matchSource = r.source_facility_name?.toLowerCase().includes(q);
        const matchDest = r.destination_facility_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchReason && !matchItem && !matchSource && !matchDest) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'created_at') {
        comp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'suggested_quantity') {
        comp = (a.suggested_quantity || 0) - (b.suggested_quantity || 0);
      } else if (sortBy === 'status') {
        comp = a.status.localeCompare(b.status);
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [recommendations, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredRecs.length / pageSize));
  const paginatedRecs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecs.slice(start, start + pageSize);
  }, [filteredRecs, page, pageSize]);

  // Counts for metric cards
  const pendingCount = recommendations.filter(r => r.status === 'PENDING').length;
  const approvedCount = recommendations.filter(r => r.status === 'APPROVED' || r.status === 'EXECUTED').length;
  const rejectedCount = recommendations.filter(r => r.status === 'REJECTED').length;

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <ArrowLeftRight className="w-8 h-8 text-primary" />
            Stock Redistribution & Approvals
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Review surplus-to-deficit rebalancing proposals and execute verified transfers.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleGenerateRecommendations}
            disabled={isGenerating}
            data-testid="generate-recommendations-btn"
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all self-start sm:self-auto text-sm font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Scanning Network...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" /> Scan & Generate Recommendations
              </>
            )}
          </button>
        )}
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Pending Approvals
            </span>
            <p className="text-2xl font-bold text-amber-950 font-mono mt-0.5">
              {pendingCount}
            </p>
            <span className="text-xs text-amber-700">Awaiting human verification</span>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Approved Transfers
            </span>
            <p className="text-2xl font-bold text-emerald-950 font-mono mt-0.5">
              {approvedCount}
            </p>
            <span className="text-xs text-emerald-700">Stock movements initiated</span>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Rejected / Closed
            </span>
            <p className="text-2xl font-bold text-gray-900 font-mono mt-0.5">
              {rejectedCount}
            </p>
            <span className="text-xs text-gray-500">Declined rebalancing proposals</span>
          </div>
          <div className="p-3 bg-gray-200 text-gray-600 rounded-xl">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          data-testid="action-feedback-banner"
          className={`p-4 rounded-xl text-sm flex items-start justify-between gap-3 shadow-xs animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <p className="font-medium">{actionFeedback.message}</p>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Unable to fetch recommendations</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadRecommendations}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search recommendation, item, or facility..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="recommendations-search-input"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              data-testid="recommendations-status-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXECUTED">Executed</option>
            </select>
          </div>

          {/* Facility Filter */}
          <div>
            <input
              type="number"
              placeholder="Filter by Facility ID"
              value={facilityIdFilter}
              onChange={(e) => {
                setFacilityIdFilter(e.target.value);
                setPage(1);
              }}
              data-testid="recommendations-facility-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </div>

        {/* Sorting & Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Displaying <strong className="text-gray-900">{filteredRecs.length}</strong> recommendations
          </span>
          <div className="flex items-center gap-3">
            <span className="font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-none bg-transparent font-semibold text-gray-800 outline-none cursor-pointer"
            >
              <option value="created_at">Generated Date</option>
              <option value="suggested_quantity">Transfer Quantity</option>
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
                setStatusFilter('');
                setFacilityIdFilter('');
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium ml-2"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Recommendations Cards List */}
      {isLoading ? (
        <div className="card p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-gray-500 text-sm">Evaluating cross-facility stock levels...</p>
        </div>
      ) : filteredRecs.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-2 border-gray-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <p className="text-gray-800 font-bold text-lg">No Pending Redistribution Proposals</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
            All facility supply reserves are balanced under current criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="recommendations-list">
          {paginatedRecs.map((rec) => {
            const details = rec.details || {};
            const sourceAvailable = (details.source_current_stock as number) ?? (details.source_available as number);
            const targetNeed = (details.target_current_stock as number) ?? (details.estimated_need as number);
            const distanceKm = details.distance_km as number;

            return (
              <div
                key={rec.id}
                data-testid={`recommendation-card-${rec.id}`}
                className="card bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0 mt-0.5">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            rec.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : rec.status === 'APPROVED' || rec.status === 'EXECUTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                          data-testid={`status-badge-${rec.id}`}
                        >
                          {rec.status}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Priority: {details.priority ? String(details.priority) : 'High Rebalance'}
                        </span>
                        {distanceKm !== undefined && (
                          <span className="text-xs text-gray-500 font-mono">
                            ~{distanceKm} km apart
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 text-base leading-snug">
                        {rec.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Generated {timeAgo(rec.created_at)} · ID: #{rec.id}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons (Pending only for staff) */}
                  {canManage && rec.status === 'PENDING' && (
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        onClick={() => {
                          setApprovingRec(rec);
                          setOverrideQuantity(rec.suggested_quantity || '');
                          setApprovalNotes('');
                        }}
                        data-testid={`approve-btn-${rec.id}`}
                        className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 border-none text-white"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>

                      <button
                        onClick={() => {
                          setModifyingRec(rec);
                          setModifyQuantity(rec.suggested_quantity || '');
                          setModifyReasoning(rec.reasoning || '');
                          setModifyNotes('');
                        }}
                        data-testid={`modify-btn-${rec.id}`}
                        className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 font-medium"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modify
                      </button>

                      <button
                        onClick={() => {
                          setRejectingRec(rec);
                          setRejectionNotes('');
                        }}
                        data-testid={`reject-btn-${rec.id}`}
                        className="px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-500" /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Transfer Route Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Source Facility */}
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                      Source (Surplus Node)
                    </span>
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {rec.source_facility_name || `Facility #${rec.source_facility_id || 'N/A'}`}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>Facility #{rec.source_facility_id}</span>
                      {sourceAvailable !== undefined && (
                        <span className="font-medium text-emerald-700">
                          ({sourceAvailable} available)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transfer Item & Quantity */}
                  <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block mb-1">
                        Transfer Payload
                      </span>
                      <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-primary" />
                        {rec.item_name || `Item #${rec.item_id}`}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-blue-100/80">
                      <span className="text-xs text-blue-700 font-medium">Suggested Volume:</span>
                      <span className="text-base font-bold font-mono text-primary" data-testid={`suggested-qty-${rec.id}`}>
                        {rec.suggested_quantity} units
                      </span>
                    </div>
                  </div>

                  {/* Destination Facility */}
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                      Destination (Deficit Node)
                    </span>
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {rec.destination_facility_name || `Facility #${rec.destination_facility_id || 'N/A'}`}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>Facility #{rec.destination_facility_id}</span>
                      {targetNeed !== undefined && (
                        <span className="font-medium text-red-700">
                          (Current stock: {targetNeed})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Operational Reasoning */}
                <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 text-xs text-gray-700 space-y-1">
                  <span className="font-bold text-gray-900 block">Analytical Rationale:</span>
                  <p className="leading-relaxed">{rec.reasoning}</p>
                </div>

                {/* Prediction / Risk Context */}
                {(rec.prediction_id || rec.risk_id) && (
                  <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                    {rec.prediction_id && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Prediction Model #{rec.prediction_id}
                      </span>
                    )}
                    {rec.risk_id && (
                      <span className="flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Risk Assessment #{rec.risk_id}
                      </span>
                    )}
                  </div>
                )}

                {/* Audit & Approval History */}
                {rec.approval_actions && rec.approval_actions.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 space-y-2" data-testid={`approval-actions-${rec.id}`}>
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Human Approval & Action Trail:
                    </span>
                    <div className="space-y-1.5">
                      {rec.approval_actions.map((act) => (
                        <div
                          key={act.id}
                          className="p-2.5 bg-gray-50 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 border border-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 uppercase text-[11px] px-2 py-0.5 bg-white rounded border">
                              {act.action}
                            </span>
                            <span className="text-gray-600">
                              by User #{act.user_id}
                            </span>
                            {act.notes && (
                              <span className="text-gray-500 italic">
                                — "{act.notes}"
                              </span>
                            )}
                          </div>
                          <span className="text-gray-400 text-[11px] font-mono">
                            {formatDate(act.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredRecs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              data-testid="recommendations-page-size"
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="recommendations-prev-page"
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
              data-testid="recommendations-next-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL */}
      {approvingRec && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirm Stock Transfer Approval
              </h3>
              <button
                onClick={() => setApprovingRec(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmApproval} className="mt-4 space-y-4">
              {/* Transfer Details Card */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
                <div className="flex justify-between font-semibold">
                  <span>Transfer Route:</span>
                  <span>
                    {approvingRec.source_facility_name || `Facility #${approvingRec.source_facility_id}`} →{' '}
                    {approvingRec.destination_facility_name || `Facility #${approvingRec.destination_facility_id}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Item:</span>
                  <span className="font-bold">{approvingRec.item_name || `Item #${approvingRec.item_id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suggested Volume:</span>
                  <span className="font-mono font-bold">{approvingRec.suggested_quantity} units</span>
                </div>
              </div>

              {/* Optional Override Quantity */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Override Quantity (Optional)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder={`Default: ${approvingRec.suggested_quantity}`}
                  value={overrideQuantity}
                  onChange={(e) => setOverrideQuantity(e.target.value ? Number(e.target.value) : '')}
                  data-testid="approval-override-qty"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Leave blank to approve the system-suggested quantity of {approvingRec.suggested_quantity} units.
                </p>
              </div>

              {/* Approval Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Approval / Verification Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified cold-chain transport availability with logistics partner."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  data-testid="approval-notes-input"
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Approving this recommendation will initiate an inter-facility transfer record. Inventory records will be updated automatically on the backend.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingRec(null)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApproval}
                  data-testid="confirm-approval-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 border-none"
                >
                  {isSubmittingApproval && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingRec && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" /> Reject Recommendation #{rejectingRec.id}
              </h3>
              <button
                onClick={() => setRejectingRec(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmRejection} className="mt-4 space-y-4">
              <p className="text-xs text-gray-600">
                Rejecting this proposal will close the recommendation without performing any inventory changes.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Source facility has scheduled surge demand next week; transfer declined."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  data-testid="rejection-notes-input"
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingRec(null)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRejection}
                  data-testid="confirm-rejection-submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {isSubmittingRejection && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Reject Recommendation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODIFY MODAL */}
      {modifyingRec && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Modify Recommendation #{modifyingRec.id}
              </h3>
              <button
                onClick={() => setModifyingRec(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmModify} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Adjust Suggested Transfer Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={modifyQuantity}
                  onChange={(e) => setModifyQuantity(e.target.value ? Number(e.target.value) : '')}
                  data-testid="modify-qty-input"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Updated Reasoning
                </label>
                <textarea
                  rows={2}
                  value={modifyReasoning}
                  onChange={(e) => setModifyReasoning(e.target.value)}
                  data-testid="modify-reasoning-input"
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Adjustment Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adjusted downwards to conserve minimum local buffer"
                  value={modifyNotes}
                  onChange={(e) => setModifyNotes(e.target.value)}
                  data-testid="modify-notes-input"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingRec(null)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModify}
                  data-testid="confirm-modify-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  {isSubmittingModify && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
