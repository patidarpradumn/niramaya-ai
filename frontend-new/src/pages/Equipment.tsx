import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, AlertTriangle, Search, X, CheckCircle2,
  Building2, Calendar, Clock, Plus, ArrowUpDown, ChevronLeft,
  ChevronRight, Loader2, ArrowRight, Cpu,
  Activity, AlertOctagon
} from 'lucide-react';
import { equipmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { equipmentStatusColor, formatDate } from '../utils';
import type { Equipment, EquipmentStatus, EquipmentCreateInput } from '../types';

const COMMON_EQUIPMENT_TYPES = [
  'Ventilator',
  'MRI Scanner',
  'CT Scanner',
  'X-Ray Machine',
  'Defibrillator',
  'Dialysis Unit',
  'Oxygen Concentrator / Plant',
  'Autoclave / Sterilizer',
  'Patient Vital Signs Monitor',
  'Centrifuge',
  'Infant Incubator',
  'Surgical Diathermy',
  'Diagnostic Ultrasound',
  'Other Biomedical Device',
];

export default function Equipment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';

  const canCreateEquipment = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin'].includes(roleLower);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isOverdueFilter, setIsOverdueFilter] = useState<string>('');
  const [facilityIdFilter, setFacilityIdFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'next_maintenance_date' | 'downtime_hours'>('next_maintenance_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Equipment Data State
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<EquipmentCreateInput>({
    facility_id: user?.facility_id || 1,
    name: '',
    equipment_type: 'Ventilator',
    serial_number: '',
    status: 'OPERATIONAL',
    installation_date: '',
    purchase_date: '',
    next_maintenance_date: '',
    downtime_hours: 0,
  });
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  useEffect(() => {
    loadEquipment();
  }, [statusFilter, isOverdueFilter, facilityIdFilter]);

  const loadEquipment = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = { limit: 150 };
      if (statusFilter) params.status = statusFilter;
      if (facilityIdFilter.trim()) params.facility_id = Number(facilityIdFilter.trim());
      if (isOverdueFilter === 'true') params.is_overdue = true;

      const res = await equipmentAPI.list(params);
      setEquipmentList(res.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load equipment directory';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) {
      setCreateError('Equipment name is required');
      return;
    }
    if (!createFormData.facility_id || createFormData.facility_id <= 0) {
      setCreateError('Valid facility ID is required');
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError('');
    try {
      const payload: EquipmentCreateInput = {
        ...createFormData,
        facility_id: Number(createFormData.facility_id),
        name: createFormData.name.trim(),
        equipment_type: createFormData.equipment_type?.trim() || undefined,
        serial_number: createFormData.serial_number?.trim() || undefined,
        installation_date: createFormData.installation_date || undefined,
        purchase_date: createFormData.purchase_date || undefined,
        next_maintenance_date: createFormData.next_maintenance_date || undefined,
        downtime_hours: Number(createFormData.downtime_hours || 0),
      };

      const res = await equipmentAPI.create(payload);
      setEquipmentList(prev => [res.data, ...prev]);
      setActionFeedback({
        type: 'success',
        message: `Equipment "${res.data.name}" registered successfully.`,
      });
      setIsCreateModalOpen(false);
      setCreateFormData({
        facility_id: user?.facility_id || 1,
        name: '',
        equipment_type: 'Ventilator',
        serial_number: '',
        status: 'OPERATIONAL',
        installation_date: '',
        purchase_date: '',
        next_maintenance_date: '',
        downtime_hours: 0,
      });
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to register equipment';
      setCreateError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Filtered & Sorted Equipment
  const filteredEquipment = useMemo(() => {
    let result = equipmentList.filter(eq => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = eq.name.toLowerCase().includes(q);
        const matchSerial = eq.serial_number?.toLowerCase().includes(q);
        const matchType = eq.equipment_type?.toLowerCase().includes(q);
        const matchFacility = eq.facility_name?.toLowerCase().includes(q) || `facility #${eq.facility_id}`.includes(q);
        if (!matchName && !matchSerial && !matchType && !matchFacility) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        comp = a.status.localeCompare(b.status);
      } else if (sortBy === 'next_maintenance_date') {
        const dateA = a.next_maintenance_date ? new Date(a.next_maintenance_date).getTime() : Infinity;
        const dateB = b.next_maintenance_date ? new Date(b.next_maintenance_date).getTime() : Infinity;
        comp = dateA - dateB;
      } else if (sortBy === 'downtime_hours') {
        comp = (a.downtime_hours || 0) - (b.downtime_hours || 0);
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [equipmentList, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / pageSize));
  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEquipment.slice(start, start + pageSize);
  }, [filteredEquipment, page, pageSize]);

  // Metric summary counts
  const totalCount = equipmentList.length;
  const operationalCount = equipmentList.filter(eq => eq.status === 'OPERATIONAL').length;
  const underMaintenanceCount = equipmentList.filter(eq => eq.status === 'UNDER_MAINTENANCE').length;
  const nonFunctionalCount = equipmentList.filter(eq => eq.status === 'NON_FUNCTIONAL').length;
  const overdueCount = equipmentList.filter(eq => eq.is_overdue_maintenance).length;

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" />
            Medical Equipment & Maintenance
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Track operational health, servicing horizons, and biomedical device availability.
          </p>
        </div>

        {canCreateEquipment && (
          <button
            onClick={() => {
              setCreateError('');
              setIsCreateModalOpen(true);
            }}
            data-testid="register-equipment-btn"
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all self-start sm:self-auto text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Register Equipment
          </button>
        )}
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="card p-3.5 bg-white border border-gray-200 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Fleet
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-gray-900 font-mono" data-testid="kpi-total-equipment">
              {totalCount}
            </p>
            <Cpu className="w-5 h-5 text-gray-400" />
          </div>
          <span className="text-[11px] text-gray-500 mt-1">Monitored units</span>
        </div>

        <div className="card p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            Operational
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-emerald-950 font-mono">
              {operationalCount}
            </p>
            <Activity className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[11px] text-emerald-700 mt-1">Ready for patient care</span>
        </div>

        <div className="card p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Under Service
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-amber-950 font-mono">
              {underMaintenanceCount}
            </p>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-[11px] text-amber-700 mt-1">Active maintenance</span>
        </div>

        <div className="card p-3.5 bg-red-50/60 border border-red-200/80 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">
            Non-Functional
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-red-950 font-mono">
              {nonFunctionalCount}
            </p>
            <AlertOctagon className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-[11px] text-red-700 mt-1">Critical breakdown</span>
        </div>

        <div className="card p-3.5 bg-orange-50/60 border border-orange-200/80 rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
            Overdue Servicing
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold text-orange-950 font-mono" data-testid="kpi-overdue-count">
              {overdueCount}
            </p>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <span className="text-[11px] text-orange-700 mt-1">Service schedule risk</span>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          data-testid="equipment-feedback-banner"
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
            <p className="font-semibold">Unable to fetch equipment records</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadEquipment}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search and Filters Card */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by name, serial, or type..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="equipment-search-input"
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

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              data-testid="equipment-status-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="NON_FUNCTIONAL">Non-Functional</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>

          {/* Overdue Maintenance Filter */}
          <div>
            <select
              value={isOverdueFilter}
              onChange={(e) => {
                setIsOverdueFilter(e.target.value);
                setPage(1);
              }}
              data-testid="equipment-overdue-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            >
              <option value="">All Servicing Schedules</option>
              <option value="true">Overdue Maintenance Only</option>
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
              data-testid="equipment-facility-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </div>

        {/* Sorting & Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Displaying <strong className="text-gray-900">{filteredEquipment.length}</strong> devices
          </span>
          <div className="flex items-center gap-3">
            <span className="font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-none bg-transparent font-semibold text-gray-800 outline-none cursor-pointer"
            >
              <option value="next_maintenance_date">Maintenance Due Date</option>
              <option value="name">Equipment Name</option>
              <option value="status">Status</option>
              <option value="downtime_hours">Downtime Hours</option>
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
                setIsOverdueFilter('');
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

      {/* Equipment Cards Grid */}
      {isLoading ? (
        <div className="card p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-gray-500 text-sm">Loading medical equipment inventory...</p>
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-2 border-gray-200">
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-800 font-bold text-lg">No Equipment Records Found</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
            No medical equipment matches current filter criteria.
          </p>
          {canCreateEquipment && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5 px-3.5 py-2"
            >
              <Plus className="w-3.5 h-3.5" /> Register First Device
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="equipment-grid">
          {paginatedEquipment.map((eq) => {
            const statusStyle = equipmentStatusColor(eq.status);
            return (
              <div
                key={eq.id}
                data-testid={`equipment-card-${eq.id}`}
                className="card bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header & Badges */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusStyle}`}
                        data-testid={`status-badge-${eq.id}`}
                      >
                        {eq.status.replace('_', ' ')}
                      </span>
                      {eq.is_overdue_maintenance && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1"
                          data-testid={`overdue-badge-${eq.id}`}
                        >
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span>Maintenance Overdue</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-gray-400">#{eq.id}</span>
                  </div>

                  {/* Title & Type */}
                  <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary transition-colors">
                    {eq.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 mb-4">
                    <span className="font-medium text-gray-700">{eq.equipment_type || 'General Medical Device'}</span>
                    <span>·</span>
                    <span className="font-mono text-gray-500">SN: {eq.serial_number || 'N/A'}</span>
                  </div>

                  {/* Operational Telemetry Box */}
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-2 mb-4 text-xs text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" /> Facility:
                      </span>
                      <span className="font-semibold text-gray-900 truncate max-w-[150px]">
                        {eq.facility_name || `Facility #${eq.facility_id}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" /> Next Service Due:
                      </span>
                      <span className={`font-semibold ${eq.is_overdue_maintenance ? 'text-red-700 font-bold' : 'text-gray-800'}`}>
                        {formatDate(eq.next_maintenance_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" /> Total Downtime:
                      </span>
                      <span className="font-mono font-medium text-gray-900">
                        {eq.downtime_hours || 0} hrs ({eq.downtime_days || 0}d)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Installed: {formatDate(eq.installation_date)}
                  </span>
                  <button
                    onClick={() => navigate(`/equipment/${eq.id}`)}
                    data-testid={`view-equipment-${eq.id}`}
                    className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline flex items-center gap-1"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredEquipment.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              data-testid="equipment-page-size"
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={6}>6 per page</option>
              <option value={9}>9 per page</option>
              <option value={15}>15 per page</option>
              <option value={30}>30 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="equipment-prev-page"
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
              data-testid="equipment-next-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* REGISTER EQUIPMENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Register Medical Equipment
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleCreateEquipment} className="mt-4 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equipment Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ventilator Model X400"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="create-equipment-name-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Facility ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={createFormData.facility_id}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, facility_id: Number(e.target.value) }))}
                    data-testid="create-equipment-facility-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={createFormData.status}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, status: e.target.value as EquipmentStatus }))}
                    data-testid="create-equipment-status-select"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    <option value="OPERATIONAL">OPERATIONAL</option>
                    <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                    <option value="NON_FUNCTIONAL">NON_FUNCTIONAL</option>
                    <option value="RETIRED">RETIRED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equipment Type
                  </label>
                  <select
                    value={createFormData.equipment_type || 'Ventilator'}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, equipment_type: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    {COMMON_EQUIPMENT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-VEN-2026-99"
                    value={createFormData.serial_number || ''}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    data-testid="create-equipment-serial-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Installation Date
                  </label>
                  <input
                    type="date"
                    value={createFormData.installation_date || ''}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, installation_date: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Next Maintenance Target
                  </label>
                  <input
                    type="date"
                    value={createFormData.next_maintenance_date || ''}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, next_maintenance_date: e.target.value }))}
                    data-testid="create-equipment-next-due-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  data-testid="create-equipment-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold"
                >
                  {isSubmittingCreate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
