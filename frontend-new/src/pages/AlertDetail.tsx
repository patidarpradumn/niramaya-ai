import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bell, AlertTriangle, ArrowLeft, CheckCircle2,
  Clock, Sparkles, Building2, Package, Calendar,
  ShieldAlert, Loader2, Info, XCircle
} from 'lucide-react';
import { alertsAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { severityColor, formatDate, timeAgo, capitalize } from '../utils';
import type { Alert, AIExplainResponse } from '../types';

const riskCategoryBadges: Record<string, { label: string; style: string }> = {
  STOCK_OUT: { label: 'Predicted Shortage Risk', style: 'bg-red-100 text-red-800 border-red-200' },
  EXPIRY: { label: 'Expiry Risk', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  EQUIPMENT: { label: 'Equipment Risk', style: 'bg-blue-100 text-blue-800 border-blue-200' },
  RESOURCE: { label: 'Resource Allocation', style: 'bg-purple-100 text-purple-800 border-purple-200' },
};

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const alertId = Number(id);

  const [alertData, setAlertData] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Acknowledge & Status Update States
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Gemini AI Explanation State
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AIExplainResponse | null>(null);
  const [aiError, setAiError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const roleLower = user?.role?.toLowerCase() || '';
  const canManageAlerts = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(roleLower);

  useEffect(() => {
    if (isNaN(alertId)) {
      setError('Invalid Alert ID specified');
      setIsLoading(false);
      return;
    }
    loadAlert();
  }, [alertId]);

  const loadAlert = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await alertsAPI.get(alertId);
      setAlertData(response.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load alert details';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!alertData) return;
    setIsAcknowledging(true);
    try {
      const res = await alertsAPI.acknowledge(alertData.id);
      setAlertData(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to acknowledge alert');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertData) return;
    setIsUpdatingStatus(true);
    try {
      const res = await alertsAPI.update(alertData.id, {
        status: targetStatus,
        resolution_notes: resolutionNotes.trim() || undefined,
      });
      setAlertData(res.data);
      setIsResolveModalOpen(false);
      setResolutionNotes('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update alert status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleExplainWithGemini = async () => {
    if (!alertData) return;
    setIsExplaining(true);
    setAiError('');
    try {
      const res = await aiAPI.explainAlert(alertData.id, selectedLanguage);
      setExplanation(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Gemini AI explanation service is unavailable';
      setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsExplaining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-16 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-gray-500 text-sm">Loading alert #{alertId} details...</p>
      </div>
    );
  }

  if (error || !alertData) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Alert Not Found</h2>
        <p className="text-gray-600 text-sm mt-1 mb-4">{error || 'The requested alert record does not exist.'}</p>
        <button onClick={() => navigate('/alerts')} className="btn-primary text-xs inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Alerts
        </button>
      </div>
    );
  }

  const sevStyle = severityColor(alertData.severity);
  const catBadge = riskCategoryBadges[alertData.risk_category] || {
    label: alertData.risk_category,
    style: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const details = alertData.details || {};

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/alerts"
          data-testid="back-to-alerts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Alerts List
        </Link>
        <span className="text-xs text-gray-400 font-mono">Alert ID: #{alertData.id}</span>
      </div>

      {/* Main Alert Banner */}
      <div className="card bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-xl ${sevStyle} shrink-0`}>
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${sevStyle}`}>
                  {alertData.severity} Severity
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${catBadge.style}`}>
                  {catBadge.label}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    alertData.status === 'ACTIVE'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : alertData.status === 'ACKNOWLEDGED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {capitalize(alertData.status)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug" data-testid="alert-detail-title">
                {alertData.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{alertData.description}</p>
            </div>
          </div>

          {/* Quick Lifecycle Actions */}
          {canManageAlerts && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              {!alertData.acknowledged && alertData.status === 'ACTIVE' && (
                <button
                  onClick={handleAcknowledge}
                  disabled={isAcknowledging}
                  data-testid="detail-acknowledge-btn"
                  className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
                >
                  {isAcknowledging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
                </button>
              )}
              {alertData.status !== 'RESOLVED' && (
                <button
                  onClick={() => {
                    setTargetStatus('RESOLVED');
                    setIsResolveModalOpen(true);
                  }}
                  data-testid="resolve-alert-btn"
                  className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                </button>
              )}
            </div>
          )}
        </div>

        {/* Operational Context Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Facility Info */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" /> Facility
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1">
              Facility #{alertData.facility_id}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {(details.facility_name as string) || 'Primary Supply Node'}
            </p>
          </div>

          {/* Item Info */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-gray-400" /> Item
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {(details.item_name as string) || (alertData.item_id ? `Item #${alertData.item_id}` : 'General Supply')}
            </p>
            <p className="text-xs text-gray-500 font-mono">
              Batch: {(details.batch_number as string) || 'N/A'}
            </p>
          </div>

          {/* Current Stock vs Forecast */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-400" /> Stock vs Demand
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {details.current_stock !== undefined ? `${details.current_stock} in stock` : 'Telemetry pending'}
            </p>
            <p className="text-xs text-gray-500">
              Min threshold: {details.min_threshold !== undefined ? String(details.min_threshold) : '—'}
            </p>
          </div>

          {/* Shortage or Expiry Horizon */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Horizon Estimate
            </span>
            <p className="text-sm font-bold text-red-700 mt-1">
              {details.days_to_stockout !== undefined
                ? `Est. ${details.days_to_stockout} days to shortage`
                : details.days_to_expiry !== undefined
                ? `Est. ${details.days_to_expiry} days to expiry`
                : 'Predicted shortage risk'}
            </p>
            <p className="text-xs text-gray-500">
              Triggered: {timeAgo(alertData.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* GEMINI AI EXPLANATION SECTION */}
      <div className="card bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/70 border border-indigo-100 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Explain with Gemini AI
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Decision Support
                </span>
              </h2>
              <p className="text-xs text-gray-600">
                Generate a grounded operational root-cause breakdown and recommended actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white outline-none"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिंदी)</option>
              <option value="Marathi">Marathi (मराठी)</option>
            </select>
            <button
              onClick={handleExplainWithGemini}
              disabled={isExplaining}
              data-testid="gemini-explain-btn"
              className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-semibold shadow-xs"
            >
              {isExplaining ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing context...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Analyze with Gemini
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Error */}
        {aiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Explanation Unavailable</p>
              <p>{aiError}</p>
            </div>
          </div>
        )}

        {/* AI Explanation Output */}
        {explanation ? (
          <div className="mt-5 space-y-4 animate-fade-in" data-testid="gemini-explanation-output">
            <div className="p-4 bg-white/90 rounded-xl border border-indigo-100 text-sm text-gray-800 leading-relaxed space-y-2">
              <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" /> Operational Analysis & Root Cause
              </h4>
              <p className="whitespace-pre-line text-gray-700">{explanation.explanation}</p>
            </div>

            {/* Disclaimer Banner */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg text-amber-900 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Decision-Support Notice:</strong> {explanation.disclaimer || 'Predictions and AI analysis provide probabilistic estimates for administrative decision support. Shortage estimates are not guaranteed.'}
              </p>
            </div>
          </div>
        ) : !isExplaining && (
          <p className="text-xs text-gray-500 mt-4 text-center py-4 bg-white/50 rounded-xl border border-dashed border-indigo-100">
            Click <strong>Analyze with Gemini</strong> to generate context-grounded recommendations for this alert.
          </p>
        )}
      </div>

      {/* Lifecycle Audit Log Details */}
      <div className="card bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-3">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" /> Alert Lifecycle & Audit Trail
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-100">
          <div>
            <span className="text-gray-400 font-medium block">Created Timestamp</span>
            <span className="font-semibold text-gray-800">{formatDate(alertData.created_at)}</span>
          </div>
          <div>
            <span className="text-gray-400 font-medium block">Acknowledged State</span>
            <span className="font-semibold text-gray-800">
              {alertData.acknowledged
                ? `Yes (${alertData.acknowledged_at ? formatDate(alertData.acknowledged_at) : 'Acknowledged'})`
                : 'Pending'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 font-medium block">Resolution State</span>
            <span className="font-semibold text-gray-800">
              {alertData.resolved_at ? `Resolved (${formatDate(alertData.resolved_at)})` : 'Active / In Progress'}
            </span>
          </div>
        </div>

        {alertData.resolution_notes && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-900">
            <span className="font-bold block mb-0.5">Resolution Notes:</span>
            <p>{alertData.resolution_notes}</p>
          </div>
        )}
      </div>

      {/* RESOLVE / DISMISS MODAL */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Update Alert Status</h3>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as any)}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                >
                  <option value="RESOLVED">RESOLVED (Supply replenished / Mitigated)</option>
                  <option value="DISMISSED">DISMISSED (Not actionable / Closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Emergency batch transfer completed from District Warehouse #3"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
