import { useState } from 'react';
import { Search, MapPin, Phone, Clock, ChevronRight, Building2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';

// Citizen-safe public facility data (NO internal inventory, NO stock data, NO alerts)
const PUBLIC_FACILITIES = [
  {
    id: 'p001',
    name: 'King Edward Memorial Hospital',
    type: 'District Hospital',
    location: 'Mumbai Central, Maharashtra',
    address: 'Acharya Donde Marg, Parel, Mumbai - 400012',
    phone: '+91-22-2308-7000',
    hours: 'Open 24 Hours',
    services: ['Emergency', 'Outpatient', 'Surgery', 'Maternity', 'Pharmacy'],
    status: 'Open',
  },
  {
    id: 'p002',
    name: 'Sion General Medical Center',
    type: 'Community Health Center',
    location: 'Sion East, Mumbai',
    address: 'Sion Hospital Rd, Sion, Mumbai - 400022',
    phone: '+91-22-2407-6000',
    hours: 'Mon–Sat 8am–8pm, Emergency 24H',
    services: ['General Medicine', 'Pediatrics', 'Maternity', 'Pharmacy', 'Lab'],
    status: 'Open',
  },
  {
    id: 'p003',
    name: 'Nashik Rural Community Center',
    type: 'Primary Health Center',
    location: 'Nashik Rural, Maharashtra',
    address: 'Village Road, Nashik Rural - 422101',
    phone: '+91-253-222-0000',
    hours: 'Mon–Fri 9am–5pm',
    services: ['General Medicine', 'Vaccination', 'Maternity', 'First Aid'],
    status: 'Open',
  },
  {
    id: 'p004',
    name: 'Pune District Government Hospital',
    type: 'District Hospital',
    location: 'Shivajinagar, Pune',
    address: 'Sassoon Rd, Shivajinagar, Pune - 411001',
    phone: '+91-20-2612-3000',
    hours: 'Open 24 Hours',
    services: ['Emergency', 'Surgery', 'ICU', 'Pediatrics', 'Trauma', 'Pharmacy'],
    status: 'Open',
  },
  {
    id: 'p005',
    name: 'Solapur Health Hub',
    type: 'Community Health Center',
    location: 'Central, Solapur',
    address: 'Gandhi Nagar, Solapur - 413001',
    phone: '+91-217-272-0000',
    hours: 'Mon–Sat 8am–6pm',
    services: ['General Medicine', 'Maternity', 'Pharmacy', 'Dental'],
    status: 'Open',
  },
];

const SERVICE_TYPES = ['All Services', 'Emergency', 'Maternity', 'Pharmacy', 'Pediatrics', 'Surgery', 'Vaccination'];
const FACILITY_TYPES = ['All Types', 'District Hospital', 'Community Health Center', 'Primary Health Center'];

export default function CitizenPortalPage() {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [typeFilter, setTypeFilter] = useState('All Types');

  const filtered = PUBLIC_FACILITIES.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.location.toLowerCase().includes(search.toLowerCase());
    const matchService = serviceFilter === 'All Services' || f.services.includes(serviceFilter);
    const matchType = typeFilter === 'All Types' || f.type === typeFilter;
    return matchSearch && matchService && matchType;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={20} />
          <h1 className="text-lg font-bold">Public Healthcare Facilities</h1>
        </div>
        <p className="text-blue-100 text-sm">Find government healthcare facilities near you. Locate services, directions, and contact information.</p>
        <p className="text-blue-200/60 text-[11px] mt-2">For medical emergencies, call 112 immediately.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search facilities by name or location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {SERVICE_TYPES.map(s => (
          <button
            key={s}
            onClick={() => setServiceFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${serviceFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {FACILITY_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${typeFilter === t ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Facility cards */}
      {filtered.length === 0 ? (
        <EmptyState title="No facilities match your search." description="Try different keywords or clear your filters." />
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <Card key={f.id} hover className="group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{f.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.status === 'Open' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
                      {f.status}
                    </span>
                    <span className="text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded">{f.type}</span>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="flex items-start gap-2 text-xs text-gray-500">
                      <MapPin size={12} className="flex-shrink-0 mt-0.5 text-blue-400" />
                      <span>{f.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={12} className="text-blue-400" />
                      <a href={`tel:${f.phone}`} className="hover:text-blue-600 transition-colors">{f.phone}</a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock size={12} className="text-blue-400" />
                      <span>{f.hours}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {f.services.map(s => (
                      <span key={s} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline">
                    Directions <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Footer notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-xs text-amber-700 font-medium">This portal provides public facility information only. For medical advice, please consult a healthcare professional. For emergencies, call 112.</p>
      </div>
    </div>
  );
}
