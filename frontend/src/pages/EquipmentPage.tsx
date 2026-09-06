import { useState } from 'react';
import { Search, Wrench, Calendar, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { Modal } from '../components/ui/Modal';
import { mockEquipment } from '../services/mock/mockData';
import type { Equipment, EquipmentStatus } from '../types';

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  Operational: 'text-green-700',
  'Maintenance Due': 'text-amber-700',
  'Issue Detected': 'text-orange-700',
  Critical: 'text-red-700',
};

const STATUS_BG: Record<EquipmentStatus, string> = {
  Operational: 'bg-green-50 border-green-100',
  'Maintenance Due': 'bg-amber-50 border-amber-100',
  'Issue Detected': 'bg-orange-50 border-orange-100',
  Critical: 'bg-red-50 border-red-100',
};

export default function EquipmentPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'All'>('All');
  const [selected, setSelected] = useState<Equipment | null>(null);

  const filtered = mockEquipment.filter(eq => {
    const matchSearch = !search || eq.name.toLowerCase().includes(search.toLowerCase()) || eq.facilityName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || eq.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    critical: mockEquipment.filter(e => e.status === 'Critical').length,
    issues: mockEquipment.filter(e => e.status === 'Issue Detected').length,
    due: mockEquipment.filter(e => e.status === 'Maintenance Due').length,
    operational: mockEquipment.filter(e => e.status === 'Operational').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Equipment Intelligence</h1>
        <p className="text-sm text-gray-500 mt-0.5">Healthcare equipment status, maintenance tracking, and issue detection.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Operational', value: counts.operational, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Maintenance Due', value: counts.due, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Issue Detected', value: counts.issues, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Critical', value: counts.critical, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search equipment or facility..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as EquipmentStatus | 'All')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          <option>Operational</option>
          <option>Maintenance Due</option>
          <option>Issue Detected</option>
          <option>Critical</option>
        </select>
      </div>

      {/* Equipment list */}
      {filtered.length === 0 ? (
        <EmptyState title="No equipment matches your filters." description="Try adjusting your search or status filter." />
      ) : (
        <div className="grid gap-3">
          {filtered.map(eq => (
            <Card
              key={eq.id}
              className={`border ${STATUS_BG[eq.status]} cursor-pointer hover:shadow-md transition-all`}
              hover
            >
              <div className="flex items-start gap-4" onClick={() => setSelected(eq)}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border ${STATUS_BG[eq.status]}`}>
                  <Wrench size={16} className={STATUS_COLORS[eq.status]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{eq.name}</span>
                    <StatusBadge status={eq.status} />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{eq.facilityName} — {eq.category}</p>
                  {eq.issue && <p className="text-xs text-red-600 font-medium">{eq.issue}</p>}
                  <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1"><Calendar size={11} />Last: {eq.lastMaintenance}</div>
                    <div className="flex items-center gap-1"><Clock size={11} />Next: {eq.nextMaintenance}</div>
                    <div>SN: {eq.serialNumber}</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Equipment detail drawer/modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Equipment Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-xs border border-gray-200 px-2 py-0.5 rounded text-gray-500">{selected.category}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Facility', selected.facilityName],
                ['Serial Number', selected.serialNumber],
                ['Install Date', selected.installDate],
                ['Maintenance Status', selected.maintenanceStatus],
                ['Last Maintenance', selected.lastMaintenance],
                ['Next Maintenance', selected.nextMaintenance],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-gray-400 font-medium mb-0.5">{k}</p>
                  <p className="text-gray-800 font-semibold">{v}</p>
                </div>
              ))}
            </div>
            {selected.issue && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Detected Issue</p>
                <p className="text-xs text-red-600">{selected.issue}</p>
              </div>
            )}
            {selected.maintenanceHistory && selected.maintenanceHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Maintenance Timeline</h3>
                <div className="space-y-2">
                  {selected.maintenanceHistory.map((h, i) => (
                    <div key={i} className="flex gap-3 items-start text-xs">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${h.status === 'Completed' ? 'bg-green-500' : h.status === 'Overdue' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{h.date}</span>
                          <span className="text-gray-400">{h.type}</span>
                          <span className={`font-medium ${h.status === 'Completed' ? 'text-green-600' : h.status === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`}>{h.status}</span>
                        </div>
                        <p className="text-gray-500">{h.technician} — {h.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
