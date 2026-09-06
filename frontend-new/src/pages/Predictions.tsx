import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, BarChart3, Search,
  Sparkles, Calendar, Building2, ShieldAlert,
  Loader2, Plus, Info, X, ChevronLeft, ChevronRight, Clock,
  ArrowUpDown
} from 'lucide-react';
import { predictionsAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, timeAgo } from '../utils';
import type { Prediction, AIExplainResponse } from '../types';

export default function Predictions() {
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';
  const canRunPredictions = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(roleLower);

  // Active Tab: demand forecasts or risk assessments
  const [activeTab, setActiveTab] = useState<'demand' | 'shortage_risks'>('demand');

  // Filter States
  const [facilityId, setFacilityId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'predicted_date' | 'confidence' | 'predicted_demand'>('predicted_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Data State
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Forecast Generation Modal
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [forecastFacilityId, setForecastFacilityId] = useState<number>(user?.facility_id || 1);
  const [forecastItemId, setForecastItemId] = useState<number>(1);
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [isSubmittingForecast, setIsSubmittingForecast] = useState(false);
  const [forecastModalError, setForecastModalError] = useState('');

  // Gemini AI Explanation Modal
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<AIExplainResponse | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    loadPredictions();
  }, [facilityId]);

  const loadPredictions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = { limit: 100 };
      if (facilityId.trim()) params.facility_id = Number(facilityId.trim());

      const res = await predictionsAPI.getDemand(params);
      setPredictions(res.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load predictions data';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForecast(true);
    setForecastModalError('');
    try {
      await predictionsAPI.forecast({
        facility_id: Number(forecastFacilityId),
        item_id: Number(forecastItemId),
        historical_days: Number(forecastDays),
      });
      await loadPredictions();
      setIsForecastModalOpen(false);
    } catch (err: any) {
      // If forecast adapter fails, try generate fallback
      try {
        await predictionsAPI.generate({
          facility_id: Number(forecastFacilityId),
          item_id: Number(forecastItemId),
        });
        await loadPredictions();
        setIsForecastModalOpen(false);
      } catch (genErr: any) {
        const msg = genErr.response?.data?.detail || genErr.message || 'Failed to generate forecast';
        setForecastModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } finally {
      setIsSubmittingForecast(false);
    }
  };

  const handleExplainPrediction = async (pred: Prediction) => {
    setSelectedPrediction(pred);
    setAiExplanation(null);
    setAiError('');
    setIsExplaining(true);
    try {
      const res = await aiAPI.explainPrediction(pred.id);
      setAiExplanation(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Gemini explanation service is unavailable';
      setAiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsExplaining(false);
    }
  };

  // Filtered and Sorted Predictions
  const filteredPredictions = useMemo(() => {
    let result = predictions.filter((p) => {
      if (minConfidence > 0 && p.confidence * 100 < minConfidence) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchFacility = `facility #${p.facility_id}`.toLowerCase().includes(q);
        const matchItem = `item #${p.item_id}`.toLowerCase().includes(q);
        if (!matchFacility && !matchItem) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'predicted_date') {
        comp = new Date(a.predicted_date).getTime() - new Date(b.predicted_date).getTime();
      } else if (sortBy === 'confidence') {
        comp = a.confidence - b.confidence;
      } else if (sortBy === 'predicted_demand') {
        comp = a.predicted_demand - b.predicted_demand;
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [predictions, searchQuery, minConfidence, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredPredictions.length / pageSize));
  const paginatedPredictions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPredictions.slice(start, start + pageSize);
  }, [filteredPredictions, page, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" />
            Demand Forecasts & Shortage Risk Analytics
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            ML-powered decision support for proactive medical resource allocation.
          </p>
        </div>

        {canRunPredictions && (
          <button
            onClick={() => {
              setForecastFacilityId(user?.facility_id || 1);
              setForecastItemId(1);
              setForecastDays(30);
              setForecastModalError('');
              setIsForecastModalOpen(true);
            }}
            data-testid="run-forecast-button"
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all self-start sm:self-auto text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Run Demand Forecast
          </button>
        )}
      </div>

      {/* Probabilistic Framing & Decision Support Disclaimer */}
      <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-start gap-3 text-indigo-950 text-xs shadow-xs">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-sm text-indigo-900">
            Decision-Support Notice
          </p>
          <p className="text-indigo-800 leading-relaxed">
            All analytical outputs provide probabilistic estimates of predicted shortage risk and projected demand to aid healthcare facility planning. Predictions represent statistical forecasts rather than guaranteed outcomes.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Unable to load predictions</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadPredictions}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('demand')}
          data-testid="tab-demand-predictions"
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'demand'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Demand Predictions ({predictions.length})
        </button>
        <button
          onClick={() => setActiveTab('shortage_risks')}
          data-testid="tab-shortage-risks"
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'shortage_risks'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Predicted Shortage Risk Overview
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by facility or item ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="predictions-search-input"
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

          {/* Facility ID Filter */}
          <div>
            <input
              type="number"
              placeholder="Filter by Facility ID"
              value={facilityId}
              onChange={(e) => {
                setFacilityId(e.target.value);
                setPage(1);
              }}
              data-testid="predictions-facility-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Minimum Confidence Filter */}
          <div>
            <select
              value={minConfidence}
              onChange={(e) => {
                setMinConfidence(Number(e.target.value));
                setPage(1);
              }}
              data-testid="predictions-confidence-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value={0}>All Confidence Levels</option>
              <option value={70}>70%+ Confidence</option>
              <option value={80}>80%+ Confidence</option>
              <option value={90}>90%+ High Confidence</option>
            </select>
          </div>
        </div>

        {/* Sorting and Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Total forecasts displayed: <strong className="text-gray-900">{filteredPredictions.length}</strong>
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
              <option value="predicted_date">Forecast Horizon Date</option>
              <option value="confidence">Confidence Score</option>
              <option value="predicted_demand">Demand Volume</option>
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
                setFacilityId('');
                setMinConfidence(0);
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium ml-2"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: DEMAND PREDICTIONS GRID */}
      {activeTab === 'demand' && (
        <>
          {isLoading ? (
            <div className="card p-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-gray-500 text-sm">Loading forecasting models...</p>
            </div>
          ) : filteredPredictions.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-2 border-gray-200">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
              <p className="text-gray-800 font-bold text-lg">No Demand Predictions Available</p>
              <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                Trigger a demand forecast to generate analytical models for your facility.
              </p>
              {canRunPredictions && (
                <button
                  onClick={() => setIsForecastModalOpen(true)}
                  className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5 px-3.5 py-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Run First Forecast
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="predictions-grid">
              {paginatedPredictions.map((pred) => {
                const confPercent = Math.round(pred.confidence * 100);
                return (
                  <div
                    key={pred.id}
                    className="card bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                            confPercent >= 85
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : confPercent >= 70
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {confPercent}% Confidence
                        </span>
                      </div>

                      {/* Title & Entities */}
                      <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary transition-colors">
                        Item #{pred.item_id}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 mb-4">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          Facility #{pred.facility_id}
                        </span>
                        <span>·</span>
                        <span className="font-mono">ID: #{pred.id}</span>
                      </div>

                      {/* Demand Forecast Metric Box */}
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-2 mb-3">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-500 font-medium">
                            Forecasted Demand
                          </span>
                          <span className="font-bold font-mono text-gray-900 text-lg">
                            {pred.predicted_demand} units
                          </span>
                        </div>

                        {/* Visual confidence gauge */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${confPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Prediction Timestamps */}
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Target Date:
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatDate(pred.predicted_date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Model Generated:
                          </span>
                          <span className="text-gray-500">
                            {timeAgo(pred.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action */}
                    <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleExplainPrediction(pred)}
                        data-testid={`explain-prediction-${pred.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Explain with Gemini
                      </button>
                      <span className="text-[11px] text-gray-400 italic">
                        Shortage risk estimate
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {filteredPredictions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  data-testid="predictions-page-size"
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value={6}>6 per page</option>
                  <option value={9}>9 per page</option>
                  <option value={15}>15 per page</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="predictions-prev-page"
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
                  data-testid="predictions-next-page"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SHORTAGE RISK OVERVIEW */}
      {activeTab === 'shortage_risks' && (
        <div className="space-y-4" data-testid="shortage-risks-tab">
          <div className="card bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Predicted Shortage Risk Assessments
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Projections based on consumption velocity and current stock buffer thresholds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Critical Shortage Risk
                </span>
                <p className="text-xl font-bold text-red-950 font-mono">
                  &lt; 7 Days Buffer
                </p>
                <p className="text-xs text-red-800">
                  Urgent inter-facility stock redistribution or emergency replenishment advised.
                </p>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Moderate Shortage Risk
                </span>
                <p className="text-xl font-bold text-amber-950 font-mono">
                  7 - 21 Days Buffer
                </p>
                <p className="text-xs text-amber-800">
                  Normal procurement reorder window recommended.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Adequate Supply Buffer
                </span>
                <p className="text-xl font-bold text-emerald-950 font-mono">
                  &gt; 21 Days Buffer
                </p>
                <p className="text-xs text-emerald-800">
                  Stock levels within optimal reserve tolerance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RUN FORECAST MODAL */}
      {isForecastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Run Demand Forecast
              </h3>
              <button
                onClick={() => setIsForecastModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleRunForecast} className="mt-4 space-y-4">
              {forecastModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {forecastModalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Facility ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={forecastFacilityId}
                  onChange={(e) => setForecastFacilityId(Number(e.target.value))}
                  data-testid="forecast-facility-input"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Item ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={forecastItemId}
                  onChange={(e) => setForecastItemId(Number(e.target.value))}
                  data-testid="forecast-item-input"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Historical Training Window (Days)
                </label>
                <select
                  value={forecastDays}
                  onChange={(e) => setForecastDays(Number(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                >
                  <option value={7}>7 Days (Recent Trend)</option>
                  <option value={14}>14 Days (Bi-weekly)</option>
                  <option value={30}>30 Days (Monthly Baseline)</option>
                  <option value={90}>90 Days (Quarterly Seasonality)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForecastModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForecast}
                  data-testid="forecast-submit-button"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  {isSubmittingForecast && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Forecast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPLAIN PREDICTION MODAL */}
      {selectedPrediction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">
                    Gemini AI Prediction Explanation
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Prediction #{selectedPrediction.id} · Item #{selectedPrediction.item_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPrediction(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {isExplaining ? (
                <div className="p-8 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="text-xs text-gray-500">Evaluating demand drivers & confidence parameters...</p>
                </div>
              ) : aiError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {aiError}
                </div>
              ) : aiExplanation ? (
                <div className="space-y-3" data-testid="prediction-gemini-output">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-800 leading-relaxed whitespace-pre-line">
                    {aiExplanation.explanation}
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                    <strong>Notice:</strong> {aiExplanation.disclaimer || 'Predictions and AI analysis provide probabilistic estimates for decision support. Shortage estimates are not guaranteed.'}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedPrediction(null)}
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