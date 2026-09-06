import { useState } from 'react';
import { ArrowRight, CheckCircle, XCircle, Edit3, Eye, Clock, Zap } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ConfirmationDialog } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { mockRecommendations } from '../services/mock/mockData';
import type { Recommendation, RecommendationStatus } from '../types';

const STATUS_ACTIONS: Record<RecommendationStatus, string> = {
  'Pending Review': 'text-amber-700 bg-amber-50 border-amber-200',
  'Approved': 'text-green-700 bg-green-50 border-green-200',
  'Rejected': 'text-red-700 bg-red-50 border-red-200',
  'Modified': 'text-blue-700 bg-blue-50 border-blue-200',
};

interface ActionDialog {
  type: 'approve' | 'reject' | 'modify';
  rec: Recommendation;
}

export default function RecommendationsPage() {
  const { showToast } = useToast();
  const [recs, setRecs] = useState(mockRecommendations);
  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingCount = recs.filter(r => r.status === 'Pending Review').length;

  const handleAction = async (type: 'approve' | 'reject' | 'modify') => {
    if (!dialog) return;
    setIsProcessing(true);
    await new Promise(res => setTimeout(res, 900));
    const newStatus: RecommendationStatus = type === 'approve' ? 'Approved' : type === 'reject' ? 'Rejected' : 'Modified';
    setRecs(prev => prev.map(r => r.id === dialog.rec.id
      ? { ...r, status: newStatus, reviewedBy: 'Dr. Priya Sharma (State Admin)', reviewedAt: new Date().toISOString() }
      : r
    ));
    setIsProcessing(false);
    setDialog(null);
    const labels = { approve: 'approved', reject: 'rejected', modify: 'flagged for modification' };
    showToast(type === 'approve' ? 'success' : type === 'reject' ? 'warning' : 'info',
      `Recommendation ${labels[type]}`,
      'Action logged in audit trail. Human authorization recorded.'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resource Redistribution</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated redistribution recommendations requiring human authorization.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pendingCount} Pending Review</span>
          )}
        </div>
      </div>

      {/* Workflow diagram */}
      <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-100 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-gray-600">
          {['Source Facility', 'Surplus Resource', 'NIRAMAYA AI', 'Destination Facility', 'Risk Reduction'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <span className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg">{step}</span>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-blue-400" />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-blue-500 text-center mt-2">AI recommends only. Human authorization is mandatory for any resource transfer.</p>
      </div>

      {/* Recommendations */}
      {recs.length === 0 ? (
        <EmptyState title="No redistribution recommendations are currently available." description="The AI system will generate recommendations when redistribution opportunities are detected." />
      ) : (
        <div className="space-y-4">
          {recs.map(rec => (
            <Card key={rec.id} className={rec.status === 'Pending Review' ? 'border-amber-200' : ''}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Source → Destination flow */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Source</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{rec.sourceFacilityName}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <ArrowRight size={16} className="text-blue-500" />
                    <div className="bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-center">
                      <p className="text-[10px] font-semibold text-blue-700">{rec.recommendedQuantity} {rec.unit}</p>
                      <p className="text-[9px] text-blue-500 truncate max-w-[80px]">{rec.resourceName}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Destination</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{rec.destinationFacilityName}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 lg:flex-col lg:items-end lg:gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_ACTIONS[rec.status]}`}>{rec.status}</span>
                  <div className="flex items-center gap-1"><Zap size={11} className="text-amber-500" /><span>{rec.confidence?.toFixed(1)}% confidence</span></div>
                  <div className="flex items-center gap-1"><Clock size={11} className="text-gray-400" /><span>{rec.estimatedTransit} transit</span></div>
                  <div className="flex items-center gap-1"><span className="text-green-600 font-semibold">↓{rec.potentialRiskReduction}%</span><span>risk reduction</span></div>
                </div>
              </div>

              {/* Reason */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-600 mb-2">{rec.reason}</p>
                {rec.reviewedBy && (
                  <p className="text-[11px] text-gray-400">Reviewed by {rec.reviewedBy} • {rec.reviewedAt ? new Date(rec.reviewedAt).toLocaleString() : ''}</p>
                )}
                {rec.notes && <p className="text-[11px] text-gray-500 italic mt-0.5">Note: {rec.notes}</p>}
              </div>

              {/* Actions */}
              {rec.status === 'Pending Review' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setDialog({ type: 'approve', rec })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    onClick={() => setDialog({ type: 'reject', rec })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  <button
                    onClick={() => setDialog({ type: 'modify', rec })}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit3 size={13} /> Modify
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 text-xs font-semibold hover:underline">
                    <Eye size={13} /> Review Details
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation dialogs */}
      <ConfirmationDialog
        isOpen={dialog?.type === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('approve')}
        title="Authorize Resource Transfer"
        confirmLabel="Authorize Transfer"
        isLoading={isProcessing}
        message={
          <div className="space-y-2">
            <p>You are authorizing the following resource redistribution:</p>
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs space-y-1">
              <p><strong>Resource:</strong> {dialog?.rec.resourceName}</p>
              <p><strong>Quantity:</strong> {dialog?.rec.recommendedQuantity} {dialog?.rec.unit}</p>
              <p><strong>From:</strong> {dialog?.rec.sourceFacilityName}</p>
              <p><strong>To:</strong> {dialog?.rec.destinationFacilityName}</p>
            </div>
            <p className="text-xs text-gray-500">This action will be logged in the audit trail. AI does not execute this transfer autonomously.</p>
          </div>
        }
      />
      <ConfirmationDialog
        isOpen={dialog?.type === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('reject')}
        title="Reject Recommendation"
        confirmLabel="Reject"
        confirmVariant="danger"
        isLoading={isProcessing}
        message="Are you sure you want to reject this AI redistribution recommendation? This action will be logged in the audit trail."
      />
      <ConfirmationDialog
        isOpen={dialog?.type === 'modify'}
        onClose={() => setDialog(null)}
        onConfirm={() => handleAction('modify')}
        title="Flag for Modification"
        confirmLabel="Flag for Modification"
        isLoading={isProcessing}
        message="This recommendation will be flagged for modification before further action. A senior administrator will be notified."
      />
    </div>
  );
}
