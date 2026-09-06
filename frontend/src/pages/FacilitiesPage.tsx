import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Filter, ChevronRight, Search, Building2, AlertTriangle, Activity } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { MetricCard } from '../components/ui/MetricCard';
import { EmptyState } from '../components/ui/States';
import { CardSkeleton } from '../components/ui/LoadingScreen';
import { mockFacilities, mockFacilityStates, mockFacilityDistricts } from '../services/mock/mockFacilities';
import { mockInventory } from '../services/mock/mockInventory';
import type { Facility, InventoryItem } from '../types';

type TabType = 'directory' | 'inventory';

function ResourceHealthBar({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 80 ? 'bg-blue-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={`w-full ${className}`}>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-24">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 mt-0.5 block">{value}%</span>
    </div>
  );
}

function FacilityRow({ facility, onClick }: { facility: Facility; onClick: () => void }) {
  const iconBg = facility.status === 'Critical Risk' ? 'bg-red-50 text-red-500' :
    facility.status === 'Moderate' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500';

  return (
    <div
      className="flex items-center gap-4 p-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`View details for ${facility.name}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {facility.status === 'Critical Risk' ? <AlertTriangle size={16} /> :
          facility.status === 'Moderate' ? <Activity size={16} /> : <Building2 size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{facility.name}</span>
          <StatusBadge status={facility.status} />
        </div>
        <p className="text-xs text-gray-400 truncate">{facility.location} • {facility.type}</p>
      </div>
      <div className="hidden sm:flex items-center gap-6">
        <div className="text-right min-w-[80px]">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Resource Health</p>
          <ResourceHealthBar value={facility.resourceHealth} />
        </div>
        <div className="text-right min-w-[70px]">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Risk Score</p>
          <span className={`text-sm font-bold ${facility.riskScore >= 7 ? 'text-red-600' : facility.riskScore >= 4 ? 'text-amber-600' : 'text-blue-600'}`}>
            {facility.riskScore.toFixed(1)} <span className="text-gray-300 font-normal">/ 10</span>
          </span>
        </div>
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
    </div>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const statusColor = item.status === 'Critical' ? 'text-red-600 bg-red-50' :
    item.status === 'Elevated Risk' ? 'text-orange-600 bg-orange-50' :
    item.status === 'Moderate' ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50';

  const urgencyColor = item.daysRemaining <= 14 ? 'text-red-600 font-bold' :
    item.daysRemaining <= 30 ? 'text-amber-600 font-semibold' : 'text-gray-600';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-gray-800">{item.resourceName}</p>
          <p className="text-[10px] text-gray-400">{item.category}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">{item.facilityName}</td>
      <td className="px-4 py-3 text-xs font-medium text-gray-800">{item.currentStock} / {item.estimatedRequirement} {item.unit}</td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="h-1.5 bg-gray-100 rounded-full w-20">
          <div
            className={`h-full rounded-full ${item.stockHealth >= 70 ? 'bg-blue-500' : item.stockHealth >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${item.stockHealth}%` }}
          />
        </div>
      </td>
      <td className={`px-4 py-3 text-xs ${urgencyColor} hidden lg:table-cell`}>{item.daysRemaining}d</td>
      <td className="px-4 py-3 text-xs text-gray-500 hidden xl:table-cell">{item.batchNumber}</td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{item.status}</span>
      </td>
    </tr>
  );
}

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('directory');
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [selectedType, setSelectedType] = useState('All Tiers');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const filteredFacilities = mockFacilities.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.location.toLowerCase().includes(search.toLowerCase());
    const matchDistrict = selectedDistrict === 'All Districts' || f.district === selectedDistrict;
    const matchStatus = selectedStatus === 'All Statuses' || f.status === selectedStatus;
    const matchType = selectedType === 'All Tiers' || f.type === selectedType;
    return matchSearch && matchDistrict && matchStatus && matchType;
  });

  const criticalCount = mockFacilities.filter(f => f.status === 'Critical Risk').length;
  const avgHealth = Math.round(mockFacilities.reduce((s, f) => s + f.resourceHealth, 0) / mockFacilities.length);
  const districts = mockFacilityDistricts[selectedState] || ['All Districts'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Network Intelligence</h1>
          <p className="text-sm text-blue-600 mt-0.5">Real-time facility telemetry, resource health, and predictive stock auditing.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Download size={14} />}>Export Report</Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'STATE', value: selectedState, options: mockFacilityStates, onChange: setSelectedState },
            { label: 'DISTRICT', value: selectedDistrict, options: districts, onChange: setSelectedDistrict },
            { label: 'FACILITY TYPE', value: selectedType, options: ['All Tiers', 'Tier 1 District Hospital', 'Community Health Center', 'Specialty Care', 'Primary Health Center'], onChange: setSelectedType },
            { label: 'STATUS', value: selectedStatus, options: ['All Statuses', 'Critical Risk', 'Moderate', 'Stable'], onChange: setSelectedStatus },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">{f.label}</label>
              <select
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('directory')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'directory' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Facilities Directory ({filteredFacilities.length})
        </button>
        <button
          onClick={() => setTab('inventory')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Inventory Intelligence &amp; Expiry
        </button>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Monitored Facilities" value="1,428" icon={<Building2 size={18} className="text-blue-600" />} iconBg="bg-blue-50" trend="+12 online" trendType="up" />
          <MetricCard label="Critical Stock Risks" value={criticalCount} icon={<AlertTriangle size={18} className="text-red-600" />} iconBg="bg-red-50" valueColor="text-red-600" subLabel="Action Req." />
          <MetricCard label="Avg Supply Health" value={`${avgHealth}%`} icon={<Activity size={18} className="text-green-600" />} iconBg="bg-green-50" trend="+2.1% w/w" trendType="up" />
          <MetricCard label="AI Forecast Accuracy" value="96.2%" icon={<Filter size={18} className="text-teal-600" />} iconBg="bg-teal-50" subLabel="Robust" />
        </div>
      )}

      {/* Content */}
      {tab === 'directory' ? (
        <Card padding="none">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-gray-400">Showing 1-{Math.min(filteredFacilities.length, 8)} of {filteredFacilities.length} records</span>
          </div>

          <div>
            <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Facility Telemetry
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg shimmer" />
                ))}
              </div>
            ) : filteredFacilities.length === 0 ? (
              <EmptyState title="No facilities match your filters." description="Try adjusting your state, district, or status filters." />
            ) : (
              filteredFacilities.map(f => (
                <FacilityRow key={f.id} facility={f} onClick={() => navigate(`/facilities/${f.id}`)} />
              ))
            )}
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Resource', 'Facility', 'Stock / Requirement', 'Health', 'Expiry', 'Batch', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockInventory.map(item => <InventoryRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
