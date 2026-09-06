import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Activity, AlertTriangle, Wrench, Clock, Download, ClipboardList } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { mockFacilities } from '../services/mock/mockFacilities';
import { mockAlerts } from '../services/mock/mockAlerts';
import { mockEquipment } from '../services/mock/mockData';

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const facility = mockFacilities.find(f => f.id === id);

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <EmptyState title="Facility not found." description="The requested facility could not be located in the network." action={{ label: 'Back to Facilities', onClick: () => navigate('/facilities') }} />
      </div>
    );
  }

  const facilityAlerts = mockAlerts.filter(a => a.facilityId === id).slice(0, 3);
  const facilityEquipment = mockEquipment.filter(e => e.facilityId === id);

  const healthMetrics = [
    { label: 'Stock Health', value: facility.resourceHealth, color: facility.resourceHealth >= 70 ? 'bg-blue-500' : facility.resourceHealth >= 40 ? 'bg-amber-500' : 'bg-red-500' },
    { label: 'Bed Occupancy', value: Math.round((facility.bedsOccupied / facility.bedCapacity) * 100), color: 'bg-blue-500' },
  ];

  const statusColor = facility.status === 'Critical Risk' ? 'bg-red-50 border-red-200' :
    facility.status === 'Moderate' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate('/facilities')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Network Intelligence
        </button>

        <div className={`rounded-xl border p-4 lg:p-5 ${statusColor}`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={facility.status} />
                <span className="text-xs text-gray-500">{facility.type}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{facility.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} /> {facility.location}
                </div>
                {facility.contactPhone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone size={12} /> {facility.contactPhone}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>Export</Button>
              <Button variant="primary" size="sm" leftIcon={<ClipboardList size={14} />}>Create Review Task</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Bed Capacity', value: facility.bedCapacity.toLocaleString(), sub: `${facility.bedsOccupied} occupied` },
          { label: 'Staff Count', value: facility.staffCount, sub: 'Active personnel' },
          { label: 'Risk Score', value: `${facility.riskScore.toFixed(1)} / 10`, sub: facility.status },
          { label: 'Last Updated', value: facility.lastUpdated, sub: 'Telemetry sync' },
        ].map(s => (
          <Card key={s.label} padding="sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
            <p className="text-[11px] text-gray-400">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Resource Health */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Activity size={16} className="text-blue-600" /> Resource Health</h2>
          <div className="space-y-4">
            {healthMetrics.map(m => (
              <div key={m.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span>{m.label}</span>
                  <span className="font-semibold">{m.value}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-500 mb-2 font-medium">Available Services</p>
              <div className="flex flex-wrap gap-1.5">
                {(facility.services || []).map(s => (
                  <span key={s} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Predictions */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Predictive Intelligence</h2>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-1">Shortage Risk (Next 7 Days)</p>
              <p className="text-xs text-red-600">Oxygen and insulin supplies are projected to approach critical thresholds within 36–72 hours based on current consumption trajectory.</p>
              <p className="text-[11px] text-red-400 mt-1">AI Decision Support — Not a guaranteed outcome</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">Demand Forecast</p>
              <p className="text-xs text-amber-600">Estimated demand increase of 12–18% over next 2 weeks based on regional epidemiological signals.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
              <span className="bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full text-[11px] font-medium">94.8% Confidence</span>
              <span>Forecast Horizon: 14 days</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Equipment */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Wrench size={16} className="text-gray-600" /> Equipment Status</h2>
          {facilityEquipment.length === 0 ? (
            <EmptyState title="No equipment records." description="No equipment is currently monitored for this facility." />
          ) : (
            <div className="space-y-2">
              {facilityEquipment.map(eq => (
                <div key={eq.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <Wrench size={14} className={eq.status === 'Critical' ? 'text-red-500' : eq.status === 'Issue Detected' ? 'text-orange-500' : eq.status === 'Maintenance Due' ? 'text-amber-500' : 'text-green-500'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{eq.name}</p>
                    <p className="text-[10px] text-gray-400">{eq.issue || eq.maintenanceStatus}</p>
                  </div>
                  <StatusBadge status={eq.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Active Alerts */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Active Alerts</h2>
          {facilityAlerts.length === 0 ? (
            <EmptyState title="No active alerts." description="This facility has no active alerts at this time." />
          ) : (
            <div className="space-y-2">
              {facilityAlerts.map(a => (
                <div key={a.id} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-[10px] text-gray-400">{a.type}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-800">{a.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={10} className="text-gray-300" />
                    <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
