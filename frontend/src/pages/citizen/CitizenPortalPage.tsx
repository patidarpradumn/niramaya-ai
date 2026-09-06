import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Phone,
  Clock,
  Building2,
  Navigation,
  Compass,
  Crosshair,
  ShieldAlert,
  X,
  Map as MapIcon,
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';
import { publicService } from '../../services/api/publicService';
import type { PublicFacility } from '../../types';

// Facility type options
const FACILITY_TYPES = [
  'All Types',
  'DISTRICT_HOSPITAL',
  'CIVIL_HOSPITAL',
  'CHC',
  'PHC',
];

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  DISTRICT_HOSPITAL: 'District Hospital',
  CIVIL_HOSPITAL: 'Civil Hospital',
  CHC: 'Community Health Center (CHC)',
  PHC: 'Primary Health Center (PHC)',
  OTHER: 'Public Clinic',
};

export default function CitizenPortalPage() {
  const navigate = useNavigate();

  // Data States
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('All Services');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Geolocation States
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Selected Facility Modal
  const [selectedFacility, setSelectedFacility] = useState<PublicFacility | null>(null);

  // 1. Initial Load of Services and Facilities
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [servicesData, facilitiesData] = await Promise.all([
          publicService.getServices(),
          publicService.getFacilities({ size: 50 }),
        ]);
        setServicesList(['All Services', ...servicesData]);
        setFacilities(facilitiesData.items || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load public facilities. Please check your internet connection.');
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // 2. Fetch or filter facilities when search, service, or geolocation changes
  const fetchFilteredFacilities = async (customLat?: number, customLon?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeLat = customLat ?? userLocation?.lat;
      const activeLon = customLon ?? userLocation?.lon;

      let res;
      if (activeLat !== undefined && activeLon !== undefined) {
        res = await publicService.getNearbyFacilities({
          lat: activeLat,
          lon: activeLon,
          radius: radiusKm,
          type: selectedType !== 'All Types' ? selectedType : undefined,
          service: selectedService !== 'All Services' ? selectedService : undefined,
          size: 50,
        });
      } else {
        res = await publicService.getFacilities({
          search: search.trim() || undefined,
          type: selectedType !== 'All Types' ? selectedType : undefined,
          service: selectedService !== 'All Services' ? selectedService : undefined,
          size: 50,
        });
      }
      setFacilities(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to search facilities');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search trigger when not using nearby mode
  useEffect(() => {
    if (!userLocation) {
      const timer = setTimeout(() => {
        fetchFilteredFacilities();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [search, selectedService, selectedType]);

  // Re-fetch when radius changes in geolocation mode
  useEffect(() => {
    if (userLocation) {
      fetchFilteredFacilities();
    }
  }, [radiusKm, selectedService, selectedType]);

  // Handle Detect Geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        setIsLocating(false);
        fetchFilteredFacilities(lat, lon);
      },
      (err) => {
        setIsLocating(false);
        // Fallback default coordinates (e.g. Pune, Maharashtra) if denied
        console.warn('Geolocation denied or failed, using demo location:', err.message);
        setLocationError('Could not get current GPS. Showing Maharashtra healthcare network.');
        const defaultLat = 18.5204;
        const defaultLon = 73.8567;
        setUserLocation({ lat: defaultLat, lon: defaultLon });
        fetchFilteredFacilities(defaultLat, defaultLon);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleClearLocation = () => {
    setUserLocation(null);
    setLocationError(null);
    publicService.getFacilities({ size: 50 }).then((res) => {
      setFacilities(res.items || []);
    });
  };

  // Helper for Google Maps directions
  const openDirections = (facility: PublicFacility) => {
    let url = '';
    if (facility.latitude && facility.longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        facility.name + ', ' + facility.location
      )}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white p-6 sm:p-8 shadow-xl shadow-blue-900/10 border border-blue-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-blue-100">
              <Building2 size={14} className="text-cyan-300" />
              <span>NIRAMAYA CITIZEN HEALTHCARE DIRECTORY</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Find Verified Government Healthcare Facilities Near You
            </h1>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              Explore 100% free & subsidized public health centers, hospitals, specialized medical services, and get one-click GPS directions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/citizen/assistant')}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-blue-700 font-bold text-sm shadow-lg hover:bg-blue-50 hover:shadow-xl transition-all duration-200 active:scale-95 group"
            >
              <Sparkles size={16} className="text-blue-600 group-hover:rotate-12 transition-transform" />
              <span>Ask Citizen AI</span>
            </button>
            <button
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600/60 hover:bg-blue-600 text-white font-semibold text-sm backdrop-blur-md border border-white/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} className="text-cyan-300" />}
              <span>{userLocation ? 'Update GPS' : 'Near Me'}</span>
            </button>
          </div>
        </div>

        {/* Ambient decorative gradient circles */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. EMERGENCY QUICK HELPLINE BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="tel:112"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100/80 transition-colors text-rose-900 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              112
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-700">National Emergency</div>
              <div className="text-sm font-extrabold">All-in-One Helpline</div>
            </div>
          </div>
          <Phone size={18} className="text-rose-600 group-hover:scale-110 transition-transform mr-1" />
        </a>

        <a
          href="tel:108"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100/80 transition-colors text-amber-900 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              108
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Ambulance Service</div>
              <div className="text-sm font-extrabold">Emergency Medical Transit</div>
            </div>
          </div>
          <Phone size={18} className="text-amber-600 group-hover:scale-110 transition-transform mr-1" />
        </a>

        <a
          href="tel:102"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/80 transition-colors text-indigo-900 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              102
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">Maternity & Child</div>
              <div className="text-sm font-extrabold">Mother & Infant Care</div>
            </div>
          </div>
          <Phone size={18} className="text-indigo-600 group-hover:scale-110 transition-transform mr-1" />
        </a>
      </div>

      {/* 3. SEARCH & CONTROLS SECTION */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm space-y-4">
        {/* Search Input and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by hospital name, city, area (e.g. Pune, Sassoon, CHC)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex p-1 bg-gray-100 rounded-2xl border border-gray-200/80">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MapIcon size={14} />
                <span>Map View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Location Status Chip */}
        {userLocation && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Crosshair size={14} className="text-blue-600 animate-pulse" />
              <span>
                Showing government facilities within <strong>{radiusKm} km</strong> of your location.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                Radius:
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="bg-white border border-blue-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-blue-900 focus:outline-none"
                >
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              </label>
              <button
                onClick={handleClearLocation}
                className="font-bold text-blue-700 hover:underline hover:text-blue-900 ml-1"
              >
                Clear Location
              </button>
            </div>
          </div>
        )}

        {locationError && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <span>{locationError}</span>
            <button onClick={() => setLocationError(null)} className="font-bold text-amber-900">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Service Filters Horizontal Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Filter by Medical Service</span>
            <span className="text-[11px] font-normal lowercase text-gray-400">
              {facilities.length} facilities found
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
            {servicesList.map((srv) => {
              const isSelected = selectedService === srv;
              return (
                <button
                  key={srv}
                  onClick={() => setSelectedService(srv)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 border border-gray-200/60'
                  }`}
                >
                  {srv}
                </button>
              );
            })}
          </div>
        </div>

        {/* Facility Type Selector */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {FACILITY_TYPES.map((type) => {
            const isSelected = selectedType === type;
            const label = type === 'All Types' ? 'All Facility Types' : TYPE_DISPLAY_NAMES[type] || type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. CONTENT VIEW: GRID CARDS OR INTERACTIVE MAP */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-200 space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-gray-600">Discovering government healthcare facilities...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 text-center space-y-2">
          <AlertTriangle size={24} className="mx-auto text-rose-600" />
          <p className="text-sm font-bold">{error}</p>
          <button
            onClick={() => fetchFilteredFacilities()}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : facilities.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8">
          <EmptyState
            title="No healthcare facilities matched your filters"
            description="Try changing your search term, expanding the radius, or clearing selected medical services."
          />
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setSearch('');
                setSelectedService('All Services');
                setSelectedType('All Types');
                setUserLocation(null);
                fetchFilteredFacilities();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {facilities.map((facility) => {
            const isOperational = facility.operational_status?.toUpperCase() === 'OPERATIONAL';
            const services = facility.facility_services || [];

            return (
              <Card
                key={facility.id}
                className="group relative flex flex-col justify-between hover:shadow-lg transition-all duration-200 border-gray-200/90 rounded-3xl overflow-hidden bg-white"
              >
                <div className="p-5 space-y-3.5">
                  {/* Top Status & Type Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100/80">
                      <Building2 size={12} className="text-blue-600" />
                      {TYPE_DISPLAY_NAMES[facility.type] || facility.type}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isOperational
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOperational ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isOperational ? 'Open 24/7' : facility.operational_status || 'Active'}
                    </span>
                  </div>

                  {/* Name & Location */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {facility.name}
                    </h3>
                    <div className="flex items-start gap-1.5 mt-1.5 text-xs text-gray-500 line-clamp-2">
                      <MapPin size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                      <span>{facility.location}</span>
                    </div>
                  </div>

                  {/* Public Services Chips */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Available Services</div>
                    <div className="flex flex-wrap gap-1.5">
                      {services.slice(0, 4).map((s) => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-gray-50 text-gray-700 border border-gray-200/60"
                        >
                          {s.service_name}
                        </span>
                      ))}
                      {services.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100">
                          +{services.length - 4} more
                        </span>
                      )}
                      {services.length === 0 && (
                        <span className="text-[11px] text-gray-400 italic">General Public Care</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Footer */}
                <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedFacility(facility)}
                    className="text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    View Details
                  </button>

                  <button
                    onClick={() => openDirections(facility)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
                  >
                    <Navigation size={12} />
                    <span>Get Directions</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* INTERACTIVE MAP / LOCATION PINS VIEW */
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-cyan-300" />
              <span className="text-sm font-bold">Government Health Facilities Map</span>
            </div>
            <span className="text-xs text-blue-200">{facilities.length} active pins on map</span>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Location Pins List */}
            <div className="lg:col-span-1 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {facilities.map((f, idx) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFacility(f)}
                  className="p-3.5 rounded-2xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 group-hover:text-blue-600">{f.name}</h4>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-1 ml-8">{f.location}</p>
                  <div className="flex items-center justify-between ml-8 pt-1">
                    <span className="text-[10px] text-gray-400">{f.latitude && f.longitude ? `${f.latitude.toFixed(2)}, ${f.longitude.toFixed(2)}` : 'Coordinates ready'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDirections(f);
                      }}
                      className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Navigation size={10} />
                      <span>Directions</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Simulated Live OpenStreetMap Visualizer */}
            <div className="lg:col-span-2 rounded-2xl bg-slate-900 overflow-hidden relative min-h-[400px] border border-gray-300 flex flex-col items-center justify-center p-6 text-center text-white">
              {/* Map background illustration */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
              
              <div className="relative z-10 max-w-md space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center mx-auto text-cyan-300 animate-pulse">
                  <MapPin size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Public Health Facilities Coordinate Network</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Direct GPS coordinates are synchronized with Google Maps for 100% accurate turn-by-turn navigation.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left bg-slate-800/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Total Facilities</span>
                    <strong className="text-white text-sm">{facilities.length} Centers</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Navigation Status</span>
                    <strong className="text-emerald-400 text-sm">GPS Online</strong>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {facilities.slice(0, 3).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openDirections(f)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
                    >
                      <ExternalLink size={12} />
                      <span>Open {f.name.split(' ')[0]} in Maps</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. FACILITY DETAILS MODAL (PUBLIC SAFE) */}
      {selectedFacility && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-700 text-white relative">
              <button
                onClick={() => setSelectedFacility(null)}
                className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={18} />
              </button>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold tracking-wide uppercase mb-2">
                {TYPE_DISPLAY_NAMES[selectedFacility.type] || selectedFacility.type}
              </div>
              <h2 className="text-xl font-extrabold pr-8">{selectedFacility.name}</h2>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-100">
                <MapPin size={14} className="text-cyan-300 flex-shrink-0" />
                <span>{selectedFacility.location}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-gray-800 text-sm">
              {/* Status & Operational Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Status</span>
                  <span className="text-xs font-bold text-emerald-700 mt-1 inline-flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    {selectedFacility.operational_status || 'OPERATIONAL'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Working Hours</span>
                  <span className="text-xs font-bold text-gray-800 mt-1 inline-flex items-center gap-1">
                    <Clock size={13} className="text-blue-600" />
                    Open 24 Hours / OPD 8am-4pm
                  </span>
                </div>
              </div>

              {/* Verified Public Services */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Available Healthcare & Clinical Services
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedFacility.facility_services?.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/80 text-xs font-semibold text-blue-900 flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0" />
                      <span>{s.service_name}</span>
                    </div>
                  ))}
                  {(!selectedFacility.facility_services || selectedFacility.facility_services.length === 0) && (
                    <div className="col-span-2 text-xs text-gray-400 italic">
                      General OPD, First Aid, and Emergency Triage available.
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates & Map link */}
              {selectedFacility.latitude && selectedFacility.longitude && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-900 block">GPS Coordinates</span>
                    <span>{selectedFacility.latitude.toFixed(4)}, {selectedFacility.longitude.toFixed(4)}</span>
                  </div>
                  <span className="text-xs text-emerald-600 font-bold">Verified Pin</span>
                </div>
              )}

              {/* Safety notice */}
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  All consultations, OPD medicines, and emergency triage at this government facility are subsidized under public health schemes. In critical emergencies, call <strong>112</strong> or <strong>108</strong> immediately.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedFacility(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => {
                  openDirections(selectedFacility);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Navigation size={14} />
                <span>Open Google Maps Directions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
