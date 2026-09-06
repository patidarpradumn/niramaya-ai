import { useState } from 'react';
import { 
  Search, 
  Wrench, 
  Calendar, 
  Clock, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Activity, 
  ArrowRight, 
  Cpu, 
  Check
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { mockEquipment } from '../services/mock/mockData';
import type { Equipment, EquipmentStatus } from '../types';

const STATUS_TABS: (EquipmentStatus | 'All')[] = ['All', 'Operational', 'Maintenance Due', 'Issue Detected', 'Critical'];

const STATUS_ACCENTS: Record<EquipmentStatus, { border: string; bg: string; text: string; iconBg: string }> = {
  Operational: {
    border: 'border border-emerald-200/80 bg-gradient-to-b from-emerald-50/20 via-white to-white hover:border-emerald-300',
    bg: 'bg-emerald-50/40',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  'Maintenance Due': {
    border: 'border border-amber-200/80 bg-gradient-to-b from-amber-50/20 via-white to-white hover:border-amber-300',
    bg: 'bg-amber-50/40',
    text: 'text-amber-700',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  'Issue Detected': {
    border: 'border border-orange-200/80 bg-gradient-to-b from-orange-50/20 via-white to-white hover:border-orange-300',
    bg: 'bg-orange-50/40',
    text: 'text-orange-700',
    iconBg: 'bg-orange-100 text-orange-700',
  },
  Critical: {
    border: 'border border-rose-200/80 bg-gradient-to-b from-rose-50/20 via-white to-white hover:border-rose-300',
    bg: 'bg-rose-50/40',
    text: 'text-rose-700',
    iconBg: 'bg-rose-100 text-rose-700',
  },
};

export default function EquipmentPage() {
  const { showToast } = useToast();
  const [equipmentList, setEquipmentList] = useState(mockEquipment);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'All'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selected, setSelected] = useState<Equipment | null>(null);

  const categories = ['All', ...Array.from(new Set(equipmentList.map(e => e.category)))];

  const filtered = equipmentList.filter(eq => {
    const matchSearch = !search || 
      eq.name.toLowerCase().includes(search.toLowerCase()) || 
      eq.facilityName.toLowerCase().includes(search.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      (eq.issue && eq.issue.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'All' || eq.status === filterStatus;
    const matchCategory = selectedCategory === 'All' || eq.category === selectedCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  const counts = {
    total: equipmentList.length,
    operational: equipmentList.filter(e => e.status === 'Operational').length,
    due: equipmentList.filter(e => e.status === 'Maintenance Due').length,
    issues: equipmentList.filter(e => e.status === 'Issue Detected').length,
    critical: equipmentList.filter(e => e.status === 'Critical').length,
  };

  const handleMarkOperational = (eqId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEquipmentList(prev => prev.map(eq => eq.id === eqId ? { ...eq, status: 'Operational' as EquipmentStatus, issue: undefined, maintenanceStatus: 'Up to date' } : eq));
    if (selected?.id === eqId) {
      setSelected(prev => prev ? { ...prev, status: 'Operational' as EquipmentStatus, issue: undefined, maintenanceStatus: 'Up to date' } : null);
    }
    showToast('success', 'Equipment Serviced', 'Device status updated to Operational in asset registry.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Equipment Intelligence</h1>
                <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                  {counts.operational}/{counts.total} Operational
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Hospital medical machinery health, preventive maintenance schedules, and fault telemetry
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm" className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Operational</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{counts.operational}</p>
            </div>
            <div className="p-2.5 bg-emerald-100/80 rounded-xl text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Maintenance Due</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{counts.due}</p>
            </div>
            <div className="p-2.5 bg-amber-100/80 rounded-xl text-amber-600">
              <Clock size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-orange-50/50 to-white border border-orange-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Issue Detected</p>
              <p className="text-2xl font-black text-orange-700 mt-0.5">{counts.issues}</p>
            </div>
            <div className="p-2.5 bg-orange-100/80 rounded-xl text-orange-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-gradient-to-br from-rose-50/50 to-white border border-rose-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Critical Faults</p>
              <p className="text-2xl font-black text-rose-700 mt-0.5">{counts.critical}</p>
            </div>
            <div className="p-2.5 bg-rose-100/80 rounded-xl text-rose-600">
              <ShieldAlert size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map(s => {
            const count = s === 'All' ? equipmentList.length : equipmentList.filter(e => e.status === s).length;
            const isSelected = filterStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
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

        {/* Category & Search Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>

          <div className="relative flex-1 md:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search equipment, SN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
            />
          </div>
        </div>
      </div>

      {/* EQUIPMENT GRID */}
      {filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <EmptyState
            icon={<CheckCircle2 size={32} className="text-emerald-500" />}
            title="No equipment matched your filters"
            description="Try selecting a different status tab or category filter."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filtered.map(eq => {
            const accent = STATUS_ACCENTS[eq.status] || STATUS_ACCENTS.Operational;
            return (
              <div
                key={eq.id}
                onClick={() => setSelected(eq)}
                className={`bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 relative overflow-hidden ${accent.border}`}
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg}`}>
                        <Wrench size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {eq.name}
                        </h3>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {eq.category}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={eq.status} />
                  </div>

                  {/* Facility Context */}
                  <div className="space-y-1.5 my-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{eq.facilityName}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span>Serial No: <strong className="text-slate-700 font-mono">{eq.serialNumber}</strong></span>
                      <span>Installed: <strong className="text-slate-700">{eq.installDate}</strong></span>
                    </div>
                  </div>

                  {/* Fault / Alert Banner if present */}
                  {eq.issue && (
                    <div className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-100/90 p-2.5 rounded-xl mb-3">
                      <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed font-medium">{eq.issue}</span>
                    </div>
                  )}

                  {/* Maintenance Schedule Strip */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100/80 flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Last Service</p>
                        <p className="font-semibold text-slate-700 truncate">{eq.lastMaintenance}</p>
                      </div>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                      eq.status === 'Maintenance Due' || eq.status === 'Critical'
                        ? 'bg-amber-50 border-amber-200/80 text-amber-900'
                        : 'bg-slate-50 border-slate-100/80 text-slate-700'
                    }`}>
                      <Clock size={13} className={eq.status === 'Maintenance Due' ? 'text-amber-600' : 'text-slate-400'} />
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase opacity-80">Next Due</p>
                        <p className="font-semibold truncate">{eq.nextMaintenance}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-gray-100 mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Activity size={12} className={eq.status === 'Operational' ? 'text-emerald-500' : 'text-amber-500'} />
                    <span>{eq.maintenanceStatus}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {eq.status !== 'Operational' && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOperational(eq.id, e)}
                        title="Mark Serviced & Operational"
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200/60"
                      >
                        <Check size={12} />
                        <span>Serviced</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>Details</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Equipment Detail Modal */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Equipment Health & Maintenance Log"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400 font-mono">
              SN: {selected?.serialNumber}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelected(null)} 
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
              {selected?.status !== 'Operational' && (
                <button
                  onClick={() => selected && handleMarkOperational(selected.id)}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Mark as Operational</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                <span className="text-xs font-semibold border border-gray-200 px-2 py-0.5 rounded-lg text-gray-600 bg-gray-50">
                  {selected.category}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Status: {selected.maintenanceStatus}</span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 leading-snug">
              {selected.name}
            </h3>

            {/* Spec grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Facility</p>
                <p className="font-bold text-slate-800 mt-0.5">{selected.facilityName}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Serial Number</p>
                <p className="font-bold text-slate-800 font-mono mt-0.5">{selected.serialNumber}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Install Date</p>
                <p className="font-bold text-slate-800 mt-0.5">{selected.installDate}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Last Maintenance</p>
                <p className="font-bold text-slate-800 mt-0.5">{selected.lastMaintenance}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Next Due</p>
                <p className="font-bold text-slate-800 mt-0.5">{selected.nextMaintenance}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                <p className="text-slate-400 font-medium">Telemetry State</p>
                <p className="font-bold text-emerald-700 mt-0.5">Online • Synced</p>
              </div>
            </div>

            {selected.issue && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs space-y-1">
                <p className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-rose-600" />
                  Active Diagnostic Issue
                </p>
                <p className="text-rose-700 leading-relaxed">{selected.issue}</p>
              </div>
            )}

            {/* Maintenance History */}
            {selected.maintenanceHistory && selected.maintenanceHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
                  <Clock size={13} />
                  Service & Calibration Timeline
                </h4>
                <div className="space-y-2">
                  {selected.maintenanceHistory.map((h, i) => (
                    <div key={i} className="flex gap-3 items-start text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${h.status === 'Completed' ? 'bg-emerald-500' : h.status === 'Overdue' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{h.date} — {h.type}</span>
                          <span className={`font-semibold px-2 py-0.2 rounded-md text-[10px] ${h.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {h.status}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1">{h.technician} • {h.notes}</p>
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
