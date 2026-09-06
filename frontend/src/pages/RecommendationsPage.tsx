import { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  Clock, 
  Zap, 
  ArrowLeftRight, 
  ShieldCheck, 
  Check, 
  X, 
  Search, 
  TrendingDown, 
  Package,
  Sparkles,
  Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ConfirmationDialog, Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { mockRecommendations } from '../services/mock/mockData';
import type { Recommendation, RecommendationStatus } from '../types';

const STATUS_TABS: (RecommendationStatus | 'All')[] = ['All', 'Pending Review', 'Approved', 'Modified', 'Rejected'];

const STATUS_BADGE_STYLES: Record<RecommendationStatus, string> = {
  'Pending Review': 'text-amber-800 bg-amber-100 border-amber-300/80',
  'Approved': 'text-emerald-800 bg-emerald-100 border-emerald-300/80',
  'Rejected': 'text-rose-800 bg-rose-100 border-rose-300/80',
  'Modified': 'text-blue-800 bg-blue-100 border-blue-300/80',
};

interface ActionDialog {
  type: 'approve' | 'reject' | 'modify';
  rec: Recommendation;
}

export default function RecommendationsPage() {
  const { showToast } = useToast();
  const [recs, setAlertRecs] = useState(mockRecommendations);
  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filtered = recs.filter(r => {
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchSearch = !search || 
      r.resourceName.toLowerCase().includes(search.toLowerCase()) ||
      r.sourceFacilityName.toLowerCase().includes(search.toLowerCase()) ||
      r.destinationFacilityName.toLowerCase().includes(search.toLowerCase()) ||
      (r.reason && r.reason.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const counts = {
    total: recs.length,
    pending: recs.filter(r => r.status === 'Pending Review').length,
    approved: recs.filter(r => r.status === 'Approved').length,
    modified: recs.filter(r => r.status === 'Modified').length,
    rejected: recs.filter(r => r.status === 'Rejected').length,
  };

  const handleAction = async (type: 'approve' | 'reject' | 'modify') => {
    if (!dialog) return;
    setIsProcessing(true);
    await new Promise(res => setTimeout(res, 600));
    const newStatus: RecommendationStatus = type === 'approve' ? 'Approved' : type === 'reject' ? 'Rejected' : 'Modified';
    setAlertRecs(prev => prev.map(r => r.id === dialog.rec.id
      ? { ...r, status: newStatus, reviewedBy: 'Dr. Priya Sharma (State Director)', reviewedAt: new Date().toISOString() }
      : r
    ));
    if (selectedRec?.id === dialog.rec.id) {
      setSelectedRec(prev => prev ? { ...prev, status: newStatus, reviewedBy: 'Dr. Priya Sharma (State Director)', reviewedAt: new Date().toISOString() } : null);
    }
    setIsProcessing(false);
    setDialog(null);
    const labels = { approve: 'authorized & scheduled', reject: 'rejected', modify: 'flagged for adjustments' };
    showToast(type === 'approve' ? 'success' : type === 'reject' ? 'warning' : 'info',
      `Redistribution ${labels[type]}`,
      'Action recorded in blockchain audit log with human cryptographic signature.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resource Redistribution</h1>
                {counts.pending > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    {counts.pending} Action Required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                AI-optimized inter-facility inventory rebalancing with mandatory human authorization
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
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Proposals</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{counts.total}</p>
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
              <ArrowLeftRight size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Review</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{counts.pending}</p>
            </div>
            <div className="p-2.5 bg-amber-100/80 rounded-xl text-amber-600">
              <Clock size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Approved Transfers</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{counts.approved}</p>
            </div>
            <div className="p-2.5 bg-emerald-100/80 rounded-xl text-emerald-600">
              <ShieldCheck size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-blue-50/50 to-white border border-blue-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Avg Risk Reduction</p>
              <p className="text-2xl font-black text-blue-700 mt-0.5">↓ 42.8%</p>
            </div>
            <div className="p-2.5 bg-blue-100/80 rounded-xl text-blue-600">
              <TrendingDown size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Human-In-The-Loop Workflow Strip */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-200 tracking-wide uppercase">Autonomous Recommendation Pipeline</p>
              <p className="text-sm font-semibold text-white mt-0.5">Surplus Facility ➔ AI Route Optimization ➔ Deficit Facility ➔ Human Sign-Off</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm self-start md:self-auto shrink-0">
            <Info size={13} className="text-blue-300" />
            <span>AI recommends only. Manual approval required.</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map(s => {
            const count = s === 'All' ? recs.length : recs.filter(r => r.status === s).length;
            const isSelected = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
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

        {/* Search */}
        <div className="relative flex-1 md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search item or facility..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
          />
        </div>
      </div>

      {/* RECOMMENDATIONS GRID */}
      {filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <EmptyState
            icon={<CheckCircle2 size={32} className="text-emerald-500" />}
            title="No redistribution recommendations found"
            description="The AI model has not detected any surplus-to-deficit imbalance matching this filter."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filtered.map(rec => (
            <div
              key={rec.id}
              onClick={() => setSelectedRec(rec)}
              className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 relative overflow-hidden"
            >
              {/* Card Top: Resource Name & Status */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                      <Package size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {rec.resourceName}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        Rebalance Transfer
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE_STYLES[rec.status]}`}>
                    {rec.status}
                  </span>
                </div>

                {/* Transfer Corridor Box */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 my-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Transfer Route</span>
                    <span className="px-2 py-0.5 bg-blue-100/80 text-blue-700 font-bold rounded-md text-[11px]">
                      {rec.recommendedQuantity} {rec.unit}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Source */}
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-black shrink-0">S</span>
                      <span className="text-xs text-slate-700 font-medium truncate">{rec.sourceFacilityName}</span>
                    </div>

                    {/* Arrow connector */}
                    <div className="pl-2 flex items-center gap-2 text-slate-300">
                      <div className="h-2 w-0.5 bg-slate-200 ml-0.5" />
                      <ArrowRight size={12} className="text-blue-500" />
                      <span className="text-[10px] font-medium text-slate-400">{rec.estimatedTransit} transit</span>
                    </div>

                    {/* Destination */}
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-black shrink-0">D</span>
                      <span className="text-xs text-slate-700 font-medium truncate">{rec.destinationFacilityName}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center gap-1.5">
                    <TrendingDown size={13} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-[9px] text-emerald-600 font-semibold uppercase">Risk Impact</p>
                      <p className="font-bold text-emerald-700">↓ {rec.potentialRiskReduction}% Risk</p>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50/70 border border-amber-100 rounded-xl flex items-center gap-1.5">
                    <Zap size={13} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="text-[9px] text-amber-600 font-semibold uppercase">AI Confidence</p>
                      <p className="font-bold text-amber-700">{rec.confidence?.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* AI Reason Preview */}
                {rec.reason && (
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100/80 mb-3 leading-relaxed">
                    {rec.reason}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-gray-100 mt-auto">
                {rec.status === 'Pending Review' ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDialog({ type: 'approve', rec }); }}
                        title="Authorize Resource Transfer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <Check size={13} />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDialog({ type: 'reject', rec }); }}
                        title="Reject Recommendation"
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-rose-200/60"
                      >
                        <X size={13} />
                        <span>Reject</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedRec(rec); }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Review</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="truncate">By {rec.reviewedBy?.split(' ')[0] || 'Admin'}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedRec(rec); }}
                      className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Details</span>
                      <Eye size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation Details Modal */}
      <Modal
        isOpen={!!selectedRec}
        onClose={() => setSelectedRec(null)}
        title="Redistribution Transfer Analysis"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400">
              Ref: {selectedRec?.id}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedRec(null)} 
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>

              {selectedRec?.status === 'Pending Review' && (
                <>
                  <button
                    onClick={() => { const r = selectedRec; setSelectedRec(null); setDialog({ type: 'reject', rec: r }); }}
                    className="px-3.5 py-2 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => { const r = selectedRec; setSelectedRec(null); setDialog({ type: 'approve', rec: r }); }}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Authorize Transfer</span>
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        {selectedRec && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE_STYLES[selectedRec.status]}`}>
                  {selectedRec.status}
                </span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                  {selectedRec.recommendedQuantity} {selectedRec.unit} • {selectedRec.resourceName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <Zap size={13} className="text-amber-600" />
                <span className="font-bold">{selectedRec.confidence?.toFixed(1)}% ML Confidence</span>
              </div>
            </div>

            {/* Transfer Corridor Full Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Source Facility (Surplus)
                </p>
                <p className="text-sm font-bold text-slate-900">{selectedRec.sourceFacilityName}</p>
                <p className="text-xs text-slate-500 mt-1">Available buffer allows redistribution without local deficit.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/70">
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Destination Facility (Critical Need)
                </p>
                <p className="text-sm font-bold text-slate-900">{selectedRec.destinationFacilityName}</p>
                <p className="text-xs text-slate-500 mt-1">Estimated stockout averted within {selectedRec.estimatedTransit}.</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">AI Optimization Rationale</h4>
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/70 text-xs text-gray-700 leading-relaxed">
                {selectedRec.reason}
              </div>
            </div>

            {selectedRec.reviewedBy && (
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600">
                <p><strong>Reviewer:</strong> {selectedRec.reviewedBy}</p>
                <p><strong>Timestamp:</strong> {selectedRec.reviewedAt ? new Date(selectedRec.reviewedAt).toLocaleString() : 'N/A'}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={dialog?.type === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('approve')}
        title="Authorize Resource Transfer"
        confirmLabel="Authorize & Schedule"
        isLoading={isProcessing}
        message={
          <div className="space-y-2.5">
            <p className="text-xs text-gray-600">You are about to authorize the inter-facility redistribution dispatch:</p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1 text-emerald-900">
              <p><strong>Resource:</strong> {dialog?.rec.resourceName} ({dialog?.rec.recommendedQuantity} {dialog?.rec.unit})</p>
              <p><strong>Origin:</strong> {dialog?.rec.sourceFacilityName}</p>
              <p><strong>Destination:</strong> {dialog?.rec.destinationFacilityName}</p>
              <p><strong>Expected Transit:</strong> {dialog?.rec.estimatedTransit}</p>
            </div>
            <p className="text-[11px] text-gray-500">
              ℹ️ Your administrative signature will be recorded in the system audit logs.
            </p>
          </div>
        }
      />

      <ConfirmationDialog
        isOpen={dialog?.type === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('reject')}
        title="Reject Redistribution Proposal"
        confirmLabel="Confirm Rejection"
        confirmVariant="danger"
        isLoading={isProcessing}
        message="Are you sure you want to reject this redistribution transfer? The deficit facility will remain on local replenishment cycle."
      />

      <ConfirmationDialog
        isOpen={dialog?.type === 'modify'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('modify')}
        title="Flag for Quantity/Route Modification"
        confirmLabel="Submit for Modification"
        isLoading={isProcessing}
        message="This proposal will be marked for parameter adjustments and reassigned to the logistics officer."
      />
    </div>
  );
}
