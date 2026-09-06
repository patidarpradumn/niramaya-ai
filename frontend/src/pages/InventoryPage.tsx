import { useState } from 'react';
import { Search, Package, Calendar } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { mockInventory } from '../services/mock/mockInventory';
import type { InventoryItem, StockStatus } from '../types';

type TabType = 'inventory' | 'expiry';

const STATUS_COLORS: Record<StockStatus, string> = {
  Healthy: 'text-green-700 bg-green-50 border-green-200',
  Moderate: 'text-amber-700 bg-amber-50 border-amber-200',
  'Elevated Risk': 'text-orange-700 bg-orange-50 border-orange-200',
  Critical: 'text-red-700 bg-red-50 border-red-200',
};

function ExpiryGroup({ label, items, color }: { label: string; items: InventoryItem[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className={`px-3 py-1.5 rounded-t-xl text-xs font-bold uppercase tracking-wider ${color}`}>{label} ({items.length})</div>
      <div className="border border-gray-200 rounded-b-xl overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Resource', 'Facility', 'Batch', 'Expiry Date', 'Days', 'Qty', 'Status', 'Action'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-800">{item.resourceName}</p>
                  <p className="text-[10px] text-gray-400">{item.category}</p>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 hidden md:table-cell">{item.facilityName}</td>
                <td className="px-3 py-2.5 text-[10px] text-gray-500 hidden lg:table-cell">{item.batchNumber}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 hidden sm:table-cell">{item.expiryDate}</td>
                <td className={`px-3 py-2.5 text-xs font-bold ${item.daysRemaining <= 14 ? 'text-red-600' : item.daysRemaining <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {item.daysRemaining}d
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{item.quantity} {item.unit}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <button className="text-[11px] text-blue-600 font-medium hover:underline cursor-pointer">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<TabType>('inventory');
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const filtered = mockInventory.filter(item => {
    const matchSearch = !search || item.resourceName.toLowerCase().includes(search.toLowerCase()) || item.facilityName.toLowerCase().includes(search.toLowerCase());
    const matchRisk = filterRisk === 'All' || item.riskLevel === filterRisk.toLowerCase();
    const matchStatus = filterStatus === 'All' || item.status === filterStatus;
    return matchSearch && matchRisk && matchStatus;
  });

  const expiryItems = [...mockInventory].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const critical = expiryItems.filter(i => i.daysRemaining < 15);
  const warning = expiryItems.filter(i => i.daysRemaining >= 15 && i.daysRemaining <= 30);
  const monitor = expiryItems.filter(i => i.daysRemaining > 30);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resource stock levels, expiry tracking, and risk assessment.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">⚠ DEMO DATA</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('inventory')} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${tab === 'inventory' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Package size={14} /> Inventory
        </button>
        <button onClick={() => setTab('expiry')} className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${tab === 'expiry' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Calendar size={14} /> Expiry Intelligence
        </button>
      </div>

      {tab === 'inventory' ? (
        <Card padding="none">
          {/* Search & Filters */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources or facilities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: filterRisk, options: ['All', 'Low', 'Medium', 'High', 'Critical'], onChange: setFilterRisk, label: 'Risk' },
                { value: filterStatus, options: ['All', 'Healthy', 'Moderate', 'Elevated Risk', 'Critical'], onChange: setFilterStatus, label: 'Status' },
              ].map(f => (
                <select key={f.label} value={f.value} onChange={e => f.onChange(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  {f.options.map(o => <option key={o}>{o === 'All' ? `All ${f.label}` : o}</option>)}
                </select>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Resource', 'Facility', 'Stock / Requirement', 'Health', 'Expiry Date', 'Days', 'Batch', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState title="No inventory items match your filters." /></td></tr>
                ) : filtered.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-800">{item.resourceName}</p>
                      <p className="text-[10px] text-gray-400">{item.category}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell max-w-[140px] truncate">{item.facilityName}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800 whitespace-nowrap">{item.currentStock} / {item.estimatedRequirement}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="h-1.5 bg-gray-100 rounded-full w-16">
                        <div className={`h-full rounded-full ${item.stockHealth >= 70 ? 'bg-blue-500' : item.stockHealth >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.stockHealth}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{item.stockHealth}%</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell whitespace-nowrap">{item.expiryDate}</td>
                    <td className={`px-4 py-3 text-xs font-bold ${item.daysRemaining <= 14 ? 'text-red-600' : item.daysRemaining <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>{item.daysRemaining}d</td>
                    <td className="px-4 py-3 text-[10px] text-gray-400 hidden xl:table-cell">{item.batchNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div>
          <div className="mb-3">
            <p className="text-sm text-gray-500">Inventory batches grouped by urgency. Items with <strong className="text-red-600">&lt;15 days</strong> require immediate action.</p>
          </div>
          <ExpiryGroup label="⚠ Critical — Less than 15 Days" items={critical} color="text-red-700 bg-red-50" />
          <ExpiryGroup label="Warning — 15 to 30 Days" items={warning} color="text-amber-700 bg-amber-50" />
          <ExpiryGroup label="Monitor — More than 30 Days" items={monitor} color="text-gray-600 bg-gray-50" />
        </div>
      )}
    </div>
  );
}
