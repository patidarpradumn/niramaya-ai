import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Bot, AlertTriangle, TrendingUp, CheckCircle, Zap, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { mockPredictionSummary, mockDemandData, mockAISynthesis } from '../services/mock/mockData';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}: <strong>{p.value?.toLocaleString()}</strong></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PredictionsPage() {
  const { criticalDistricts, elevatedFacilities, stableHubs } = mockPredictionSummary;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-widest text-teal-600 uppercase">AI Neural Engine • State Synthesis</span>
            <span className="text-[10px] bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full font-semibold">Model Active</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Predictive Intelligence &amp; Redistribution</h1>
          <p className="text-sm text-gray-400 mt-0.5">Anticipating medical resource strains through multi-variate epidemiological forecasting and automated logistical balancing.</p>
        </div>
      </div>

      {/* Three Risk Panels */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Critical Threshold */}
        <Card className="border-red-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-widest text-red-600 uppercase">Critical Threshold</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{criticalDistricts} Districts</div>
          <p className="text-xs text-gray-500 mb-3">Demand pressure is approaching or exceeding configured safety thresholds.</p>
          <div className="h-1.5 bg-red-100 rounded-full">
            <div className="h-full bg-red-500 rounded-full w-4/5" />
          </div>
        </Card>

        {/* Elevated Risk */}
        <Card className="border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-widest text-amber-600 uppercase">Elevated Risk</span>
            <TrendingUp size={16} className="text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{elevatedFacilities} Facilities</div>
          <p className="text-xs text-gray-500 mb-3">Resource depletion trajectory is approaching safety buffers.</p>
          <div className="h-1.5 bg-amber-100 rounded-full">
            <div className="h-full bg-amber-500 rounded-full w-2/4" />
          </div>
        </Card>

        {/* Stable Equilibrium */}
        <Card className="border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">Stable Equilibrium</span>
            <CheckCircle size={16} className="text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stableHubs} Hubs</div>
          <p className="text-xs text-gray-500 mb-3">Supply conditions remain within configured operational ranges.</p>
          <div className="h-1.5 bg-blue-100 rounded-full">
            <div className="h-full bg-blue-500 rounded-full w-5/6" />
          </div>
        </Card>
      </div>

      {/* Historical vs Forecasted Demand Chart */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Historical vs. Forecasted Demand</h2>
            <p className="text-xs text-gray-400">Oxygen and Antiviral consumption index over a 6-week rolling window.</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-blue-500 rounded" />
              <span className="text-gray-500">Actual Demand</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-amber-700 rounded border-dashed" style={{ borderTop: '2px dashed #B45309', height: 0 }} />
              <span className="text-gray-500">AI Forecast</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={mockDemandData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x="CURRENT"
              stroke="#2563EB"
              strokeDasharray="4 2"
              label={{ value: 'CURRENT', position: 'top', fontSize: 10, fill: '#2563EB', fontWeight: 700 }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Demand"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="AI Forecast"
              stroke="#92400E"
              strokeWidth={2.5}
              strokeDasharray="7 4"
              dot={{ r: 4, fill: '#92400E', strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-3 mt-2 pt-3 border-t border-gray-100">
          {['+1 WEEK (AI)', '+2 WEEKS (AI)'].map(label => (
            <span key={label} className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">{label} — Forecasted</span>
          ))}
          <span className="text-[11px] text-gray-400 ml-auto">Forecast shown as estimated projection only — not a guaranteed outcome.</span>
        </div>
      </Card>

      {/* AI Decision Support Synthesis */}
      <Card className="border-teal-100 bg-gradient-to-br from-white to-teal-50/30">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-teal-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Decision Support Synthesis</h2>
            <p className="text-[11px] text-teal-600">Generated via deep neural aggregation of regional intake logs</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded-lg p-4 mb-4">
          {mockAISynthesis.text}
        </p>

        <div className="flex flex-wrap gap-3">
          {mockAISynthesis.confidence && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              <Zap size={12} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Confidence: {mockAISynthesis.confidence}%</span>
            </div>
          )}
          {mockAISynthesis.estimatedTransit && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5">
              <Clock size={12} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Estimated Transit: {mockAISynthesis.estimatedTransit}</span>
            </div>
          )}
          {mockAISynthesis.forecastHorizon && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
              <TrendingUp size={12} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-600">Forecast Horizon: {mockAISynthesis.forecastHorizon}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 mt-4 border-t border-gray-100 pt-3">
          ⚠ This is AI decision support only. No autonomous government action has been taken. Human authorization is required for any redistribution or procurement.
        </p>
      </Card>
    </div>
  );
}
