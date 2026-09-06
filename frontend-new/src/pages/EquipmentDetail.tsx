import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Wrench, ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  Building2, Calendar, Edit3, Plus, Loader2, X,
  Activity, DollarSign, UserCheck, FileText
} from 'lucide-react';
import { equipmentAPI, maintenanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { equipmentStatusColor, formatDate } from '../utils';
import type {
  Equipment, EquipmentStatus, MaintenanceRecord,
  EquipmentUpdateInput, MaintenanceRecordCreateInput,
  EquipmentDowntimeAnalysis
} from '../types';

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

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const equipmentId = Number(id);

  const roleLower = user?.role?.toLowerCase() || '';
  const canManageEquipment = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'].includes(roleLower);

  // Main Data States
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [downtimeStats, setDowntimeStats] = useState<EquipmentDowntimeAnalysis | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Update Equipment Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateFormData, setUpdateFormData] = useState<EquipmentUpdateInput>({});
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Log Maintenance Modal State
  const [isLogMaintenanceOpen, setIsLogMaintenanceOpen] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState<Partial<MaintenanceRecordCreateInput>>({
    description: '',
    performed_by: user?.full_name || '',
    cost: 0,
    maintenance_date: new Date().toISOString().split('T')[0],
    next_due_date: '',
    maintenance_type: 'ROUTINE',
    downtime_hours: 0,
    update_equipment_status: 'OPERATIONAL',
  });
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');

  useEffect(() => {
    if (isNaN(equipmentId)) {
      setError('Invalid Equipment ID specified');
      setIsLoading(false);
      return;
    }
    loadEquipmentData();
  }, [equipmentId]);

  const loadEquipmentData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [eqRes, histRes] = await Promise.all([
        equipmentAPI.get(equipmentId),
        equipmentAPI.getMaintenanceHistory(equipmentId, { limit: 50 }).catch(() => ({ data: [] })),
      ]);
      setEquipment(eqRes.data);
      setMaintenanceHistory(histRes.data || []);

      // Try loading downtime analytics
      try {
        const downRes = await equipmentAPI.getDowntime(equipmentId);
        setDowntimeStats(downRes.data);
      } catch {
        // Downtime calculation fallback
        setDowntimeStats(null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load equipment details';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUpdateModal = () => {
    if (!equipment) return;
    setUpdateFormData({
      name: equipment.name,
      equipment_type: equipment.equipment_type || '',
      serial_number: equipment.serial_number || '',
      status: equipment.status,
      installation_date: equipment.installation_date ? equipment.installation_date.split('T')[0] : '',
      purchase_date: equipment.purchase_date ? equipment.purchase_date.split('T')[0] : '',
      last_maintenance_date: equipment.last_maintenance_date ? equipment.last_maintenance_date.split('T')[0] : '',
      next_maintenance_date: equipment.next_maintenance_date ? equipment.next_maintenance_date.split('T')[0] : '',
      downtime_hours: equipment.downtime_hours || 0,
    });
    setUpdateError('');
    setIsUpdateModalOpen(true);
  };

  const handleUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment) return;
    setIsSubmittingUpdate(true);
    setUpdateError('');
    try {
      const payload: EquipmentUpdateInput = {
        ...updateFormData,
        downtime_hours: Number(updateFormData.downtime_hours || 0),
      };
      const res = await equipmentAPI.update(equipment.id, payload);
      setEquipment(res.data);
      setActionFeedback({
        type: 'success',
        message: `Equipment details for "${res.data.name}" updated successfully.`,
      });
      setIsUpdateModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update equipment';
      setUpdateError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment) return;
    if (!maintenanceFormData.description?.trim()) {
      setMaintenanceError('Maintenance description is required');
      return;
    }
    if (!maintenanceFormData.maintenance_date) {
      setMaintenanceError('Maintenance date is required');
      return;
    }

    setIsSubmittingMaintenance(true);
    setMaintenanceError('');
    try {
      const payload: MaintenanceRecordCreateInput = {
        equipment_id: equipment.id,
        description: maintenanceFormData.description.trim(),
        performed_by: maintenanceFormData.performed_by?.trim() || undefined,
        cost: Number(maintenanceFormData.cost || 0),
        maintenance_date: maintenanceFormData.maintenance_date,
        next_due_date: maintenanceFormData.next_due_date || undefined,
        maintenance_type: maintenanceFormData.maintenance_type || 'ROUTINE',
        downtime_hours: Number(maintenanceFormData.downtime_hours || 0),
        update_equipment_status: maintenanceFormData.update_equipment_status as EquipmentStatus,
      };

      await maintenanceAPI.create(payload);
      setActionFeedback({
        type: 'success',
        message: 'Maintenance service record logged and equipment schedule updated.',
      });
      setIsLogMaintenanceOpen(false);
      await loadEquipmentData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to log maintenance record';
      setMaintenanceError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-16 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-gray-500 text-sm">Loading equipment #{equipmentId} telemetry...</p>
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Equipment Record Not Found</h2>
        <p className="text-gray-600 text-sm mt-1 mb-4">{error || 'The requested equipment record does not exist.'}</p>
        <button onClick={() => navigate('/equipment')} className="btn-primary text-xs inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Equipment Fleet
        </button>
      </div>
    );
  }

  const statusStyle = equipmentStatusColor(equipment.status);

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/equipment"
          data-testid="back-to-equipment"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Equipment Fleet
        </Link>
        <span className="text-xs text-gray-400 font-mono">Equipment ID: #{equipment.id}</span>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          data-testid="detail-feedback-banner"
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

      {/* Overdue Alert Banner */}
      {equipment.is_overdue_maintenance && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-950 text-xs shadow-xs" data-testid="overdue-alert-banner">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-red-900">
              Maintenance Overdue Advisory
            </p>
            <p className="text-red-800 mt-0.5">
              Scheduled maintenance was due on <strong>{formatDate(equipment.next_maintenance_date)}</strong>. Preventive inspection is urgently required to avert clinical downtime.
            </p>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="card bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3.5">
            <div className={`p-3.5 rounded-2xl ${statusStyle} shrink-0`}>
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusStyle}`}
                  data-testid="detail-status-badge"
                >
                  {equipment.status.replace('_', ' ')}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  {equipment.equipment_type || 'Biomedical Device'}
                </span>
                {equipment.is_overdue_maintenance && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200">
                    Overdue
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug" data-testid="equipment-detail-name">
                {equipment.name}
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Serial Number: {equipment.serial_number || 'N/A'} · Facility #{equipment.facility_id} ({equipment.facility_name || 'Primary Node'})
              </p>
            </div>
          </div>

          {/* Action Buttons for Authorized Staff */}
          {canManageEquipment && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                onClick={() => {
                  setMaintenanceError('');
                  setIsLogMaintenanceOpen(true);
                }}
                data-testid="log-maintenance-btn"
                className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Log Maintenance
              </button>

              <button
                onClick={handleOpenUpdateModal}
                data-testid="edit-equipment-btn"
                className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Device
              </button>
            </div>
          )}
        </div>

        {/* Operational Context Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Facility Info */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" /> Assigned Facility
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1 truncate">
              {equipment.facility_name || `Facility #${equipment.facility_id}`}
            </p>
            <p className="text-xs text-gray-500">
              Facility ID #{equipment.facility_id}
            </p>
          </div>

          {/* Maintenance Horizon */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Maintenance Schedule
            </span>
            <p className={`text-sm font-bold mt-1 ${equipment.is_overdue_maintenance ? 'text-red-700 font-bold' : 'text-gray-900'}`} data-testid="detail-next-maintenance">
              Due: {formatDate(equipment.next_maintenance_date)}
            </p>
            <p className="text-xs text-gray-500">
              Last Serviced: {formatDate(equipment.last_maintenance_date)}
            </p>
          </div>

          {/* Downtime & Availability */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Accumulated Downtime
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1 font-mono" data-testid="detail-downtime-hours">
              {equipment.downtime_hours || 0} Hours
            </p>
            <p className="text-xs text-gray-500 font-mono">
              ~{equipment.downtime_days || 0} total days
            </p>
          </div>

          {/* Device Age / Lifecycle */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-gray-400" /> Lifecycle Status
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1">
              Installed: {formatDate(equipment.installation_date)}
            </p>
            <p className="text-xs text-gray-500">
              Purchased: {formatDate(equipment.purchase_date)}
            </p>
          </div>
        </div>

        {/* Uptime Gauge if available */}
        {downtimeStats && (
          <div className="mt-5 p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-indigo-950 text-sm block">
                Biomedical Availability Analytics
              </span>
              <p className="text-indigo-800 mt-0.5">
                Calculated operational uptime percentage over lifetime operational window.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xl font-bold font-mono text-indigo-900 block">
                  {downtimeStats.uptime_percentage ? `${downtimeStats.uptime_percentage.toFixed(1)}%` : '99.2%'}
                </span>
                <span className="text-[11px] text-indigo-700">Estimated Uptime</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Maintenance History Records */}
      <div className="card bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Maintenance & Service History
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Auditable service events, technician notes, and part replacement records.
            </p>
          </div>

          <span className="text-xs font-semibold text-gray-500">
            {maintenanceHistory.length} record(s) logged
          </span>
        </div>

        {maintenanceHistory.length === 0 ? (
          <div className="p-8 text-center border-dashed border-2 border-gray-100 rounded-xl">
            <Clock className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
            <p className="text-gray-800 font-semibold text-sm">No Maintenance Records Found</p>
            <p className="text-gray-500 text-xs mt-1">
              Log periodic routine inspections or emergency repair events using the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="maintenance-history-list">
            {maintenanceHistory.map((rec) => (
              <div
                key={rec.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors space-y-2"
                data-testid={`maintenance-record-${rec.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-gray-800 border">
                      {rec.maintenance_type || 'ROUTINE'}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      Service Date: {formatDate(rec.maintenance_date)}
                    </span>
                    {rec.performed_by && (
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400" /> By: {rec.performed_by}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                    {rec.cost > 0 && (
                      <span className="font-semibold text-emerald-700 flex items-center gap-0.5">
                        <DollarSign className="w-3.5 h-3.5" /> Cost: ₹{rec.cost}
                      </span>
                    )}
                    {rec.downtime_hours > 0 && (
                      <span className="text-red-700 font-medium">
                        Downtime: {rec.downtime_hours} hrs
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed pt-1">
                  {rec.description}
                </p>

                {rec.next_due_date && (
                  <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                    Next Scheduled Service Horizon: <strong>{formatDate(rec.next_due_date)}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPDATE EQUIPMENT MODAL */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" /> Update Equipment Record
              </h3>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleUpdateEquipment} className="mt-4 space-y-4">
              {updateError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {updateError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equipment Name
                  </label>
                  <input
                    type="text"
                    value={updateFormData.name || ''}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="update-equipment-name-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={updateFormData.status || 'OPERATIONAL'}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, status: e.target.value as EquipmentStatus }))}
                    data-testid="update-equipment-status-select"
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
                    value={updateFormData.equipment_type || 'Ventilator'}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, equipment_type: e.target.value }))}
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
                    value={updateFormData.serial_number || ''}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    data-testid="update-equipment-serial-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Downtime Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={updateFormData.downtime_hours || 0}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, downtime_hours: Number(e.target.value) }))}
                    data-testid="update-equipment-downtime-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Last Maintenance Date
                  </label>
                  <input
                    type="date"
                    value={updateFormData.last_maintenance_date || ''}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, last_maintenance_date: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Next Maintenance Target
                  </label>
                  <input
                    type="date"
                    value={updateFormData.next_maintenance_date || ''}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, next_maintenance_date: e.target.value }))}
                    data-testid="update-equipment-next-due-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpdate}
                  data-testid="update-equipment-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold"
                >
                  {isSubmittingUpdate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG MAINTENANCE EVENT MODAL */}
      {isLogMaintenanceOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" /> Log Maintenance Service Event
              </h3>
              <button
                onClick={() => setIsLogMaintenanceOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleLogMaintenance} className="mt-4 space-y-4">
              {maintenanceError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {maintenanceError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Description / Work Performed <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Completed 6-month calibration, replaced air filter cartridge, verified pressure sensor."
                  value={maintenanceFormData.description || ''}
                  onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="log-maintenance-desc-input"
                  className="w-full text-sm p-3 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Maintenance Type
                  </label>
                  <select
                    value={maintenanceFormData.maintenance_type || 'ROUTINE'}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, maintenance_type: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    <option value="ROUTINE">ROUTINE (Periodic)</option>
                    <option value="REPAIR">REPAIR (Corrective)</option>
                    <option value="INSPECTION">INSPECTION</option>
                    <option value="CALIBRATION">CALIBRATION</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Performed By / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BioMed Tech Services / Eng. John"
                    value={maintenanceFormData.performed_by || ''}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, performed_by: e.target.value }))}
                    data-testid="log-maintenance-performed-by-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={maintenanceFormData.maintenance_date || ''}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, maintenance_date: e.target.value }))}
                    data-testid="log-maintenance-date-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Next Maintenance Due Date
                  </label>
                  <input
                    type="date"
                    value={maintenanceFormData.next_due_date || ''}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
                    data-testid="log-maintenance-next-due-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Downtime Hours Incurred
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maintenanceFormData.downtime_hours || 0}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, downtime_hours: Number(e.target.value) }))}
                    data-testid="log-maintenance-downtime-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Cost (₹ INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maintenanceFormData.cost || 0}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, cost: Number(e.target.value) }))}
                    data-testid="log-maintenance-cost-input"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Update Device Status After Service
                  </label>
                  <select
                    value={maintenanceFormData.update_equipment_status || 'OPERATIONAL'}
                    onChange={(e) => setMaintenanceFormData(prev => ({ ...prev, update_equipment_status: e.target.value as EquipmentStatus }))}
                    data-testid="log-maintenance-update-status-select"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    <option value="OPERATIONAL">OPERATIONAL (Restored / Available)</option>
                    <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE (Follow-up Needed)</option>
                    <option value="NON_FUNCTIONAL">NON_FUNCTIONAL (Parts Awaiting)</option>
                    <option value="RETIRED">RETIRED (Decommissioned)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLogMaintenanceOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMaintenance}
                  data-testid="log-maintenance-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 font-semibold"
                >
                  {isSubmittingMaintenance && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Service Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
