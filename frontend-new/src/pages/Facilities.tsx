import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Mail, Phone, Plus, Edit2, Search,
  X, AlertCircle, Globe, ChevronLeft,
  ChevronRight, ArrowUpDown, LayoutGrid, List as ListIcon, Loader2
} from 'lucide-react';
import { facilitiesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Facility, FacilityType, FacilityService, FacilityCreateInput } from '../types';

const facilityTypeLabels: Record<string, string> = {
  DISTRICT_HOSPITAL: 'District Hospital',
  CIVIL_HOSPITAL: 'Civil Hospital',
  CHC: 'Community Health Centre (CHC)',
  PHC: 'Primary Health Centre (PHC)',
  OTHER: 'Other Facility',
  hospital: 'Hospital',
  clinic: 'Clinic',
  warehouse: 'Warehouse',
  distribution_center: 'Distribution Center',
};

const facilityTypeColors: Record<string, string> = {
  DISTRICT_HOSPITAL: 'bg-blue-100 text-blue-800 border-blue-200',
  CIVIL_HOSPITAL: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CHC: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PHC: 'bg-teal-100 text-teal-800 border-teal-200',
  OTHER: 'bg-gray-100 text-gray-800 border-gray-200',
  hospital: 'bg-blue-100 text-blue-800 border-blue-200',
  clinic: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
  distribution_center: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default function Facilities() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';

  // Role permissions
  const canCreateFacility = ['super_admin', 'state_admin', 'district_admin'].includes(roleLower);
  const canEditFacility = ['super_admin', 'state_admin', 'district_admin', 'hospital_admin'].includes(roleLower);

  // Listing state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'location'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Modals
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form State
  const [formData, setFormData] = useState<FacilityCreateInput>({
    name: '',
    location: '',
    type: 'DISTRICT_HOSPITAL' as FacilityType,
    district_id: null,
    contact_email: '',
    contact_phone: '',
    is_active: true,
    latitude: null,
    longitude: null,
    operational_status: 'OPERATIONAL',
  });

  // Services for selected facility
  const [facilityServices, setFacilityServices] = useState<FacilityService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    loadFacilities();
  }, [searchQuery, selectedType, selectedStatus]);

  const loadFacilities = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = {
        limit: 200, // Fetch up to 200 items for responsive client filtering & pagination
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedType) params.type = selectedType;
      if (selectedStatus) params.operational_status = selectedStatus;

      const response = await facilitiesAPI.list(params);
      setFacilities(response.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load facilities';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (facility: Facility) => {
    setSelectedFacility(facility);
    setIsDetailModalOpen(true);
    setLoadingServices(true);
    try {
      const res = await facilitiesAPI.getServices(facility.id);
      setFacilityServices(res.data || []);
    } catch {
      // Fall back to facility.facility_services if endpoint fails
      setFacilityServices(facility.facility_services || []);
    } finally {
      setLoadingServices(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormMode('create');
    setFormData({
      name: '',
      location: '',
      type: 'DISTRICT_HOSPITAL' as FacilityType,
      district_id: user?.district_id || null,
      contact_email: '',
      contact_phone: '',
      is_active: true,
      latitude: null,
      longitude: null,
      operational_status: 'OPERATIONAL',
    });
    setFormError('');
    setFieldErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (facility: Facility) => {
    setFormMode('edit');
    setSelectedFacility(facility);
    setFormData({
      name: facility.name,
      location: facility.location,
      type: facility.type,
      district_id: facility.district_id,
      contact_email: facility.contact_email || '',
      contact_phone: facility.contact_phone || '',
      is_active: facility.is_active,
      latitude: facility.latitude,
      longitude: facility.longitude,
      operational_status: facility.operational_status || 'OPERATIONAL',
    });
    setFormError('');
    setFieldErrors({});
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Facility name is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.type) errors.type = 'Facility type is required';

    if (formData.latitude !== null && formData.latitude !== undefined) {
      const lat = Number(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.latitude = 'Latitude must be between -90 and 90';
      }
    }

    if (formData.longitude !== null && formData.longitude !== undefined) {
      const lng = Number(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    if (formData.contact_email && formData.contact_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contact_email.trim())) {
        errors.contact_email = 'Invalid email address format';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    setFormError('');
    try {
      const payload: any = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        type: formData.type,
        operational_status: formData.operational_status || 'OPERATIONAL',
        is_active: Boolean(formData.is_active),
      };

      if (formData.district_id) payload.district_id = Number(formData.district_id);
      if (formData.contact_email?.trim()) payload.contact_email = formData.contact_email.trim();
      if (formData.contact_phone?.trim()) payload.contact_phone = formData.contact_phone.trim();
      if (formData.latitude !== null && formData.latitude !== undefined && formData.latitude !== ('' as any)) {
        payload.latitude = Number(formData.latitude);
      }
      if (formData.longitude !== null && formData.longitude !== undefined && formData.longitude !== ('' as any)) {
        payload.longitude = Number(formData.longitude);
      }

      if (formMode === 'create') {
        const res = await facilitiesAPI.create(payload);
        setFacilities(prev => [res.data, ...prev]);
      } else if (selectedFacility) {
        const res = await facilitiesAPI.update(selectedFacility.id, payload);
        setFacilities(prev => prev.map(f => f.id === selectedFacility.id ? res.data : f));
        setSelectedFacility(res.data);
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save facility';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Sorted and Paginated Facilities
  const filteredAndSortedFacilities = useMemo(() => {
    let result = [...facilities];

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'type') {
        comparison = (a.type || '').localeCompare(b.type || '');
      } else if (sortBy === 'location') {
        comparison = a.location.localeCompare(b.location);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [facilities, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedFacilities.length / pageSize));
  const paginatedFacilities = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedFacilities.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedFacilities, page, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Healthcare Facilities
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Manage hospitals, community centres, and regional supply nodes.
          </p>
        </div>

        {canCreateFacility && (
          <button
            onClick={handleOpenCreate}
            data-testid="add-facility-button"
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all self-start sm:self-auto text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Facility
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Unable to fetch facilities</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadFacilities}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search facility name or location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="facility-search-input"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
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

          {/* Facility Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              data-testid="facility-type-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-colors"
            >
              <option value="">All Facility Types</option>
              <option value="DISTRICT_HOSPITAL">District Hospital</option>
              <option value="CIVIL_HOSPITAL">Civil Hospital</option>
              <option value="CHC">CHC</option>
              <option value="PHC">PHC</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Operational Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              data-testid="facility-status-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* View Toggle & Reset */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('');
                setSelectedStatus('');
                setPage(1);
              }}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-2 rounded font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-xs text-primary' : 'text-gray-500'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow-xs text-primary' : 'text-gray-500'}`}
                title="Table View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sorting and Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Showing <strong className="text-gray-900">{filteredAndSortedFacilities.length}</strong> facilities
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-none bg-transparent font-semibold text-gray-800 outline-none cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="type">Type</option>
              <option value="location">Location</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-primary hover:underline font-medium"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="card p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-gray-500 text-sm">Loading facilities directory...</p>
        </div>
      ) : filteredAndSortedFacilities.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-2 border-gray-200">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-800 font-semibold text-lg">No Facilities Found</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
            Try adjusting your search query, type filters, or operational status.
          </p>
          {canCreateFacility && (
            <button
              onClick={handleOpenCreate}
              className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5 px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Facility
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="facilities-grid">
          {paginatedFacilities.map((facility) => (
            <div
              key={facility.id}
              className="card bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        facilityTypeColors[facility.type] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {facilityTypeLabels[facility.type] || facility.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        facility.operational_status?.toUpperCase() === 'OPERATIONAL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {facility.operational_status || 'OPERATIONAL'}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 group-hover:text-primary transition-colors">
                  {facility.name}
                </h3>

                <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{facility.location}</span>
                  </div>
                  {facility.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{facility.contact_email}</span>
                    </div>
                  )}
                  {facility.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{facility.contact_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenDetails(facility)}
                  data-testid={`view-facility-${facility.id}`}
                  className="text-xs font-semibold text-primary hover:text-primary-dark hover:underline py-1"
                >
                  View Details & Services →
                </button>
                {canEditFacility && (
                  <button
                    onClick={() => handleOpenEdit(facility)}
                    data-testid={`edit-facility-${facility.id}`}
                    className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
                    title="Edit Facility"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-xs" data-testid="facilities-table">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Facility Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedFacilities.map((facility) => (
                <tr key={facility.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-900">{facility.name}</div>
                    <div className="text-xs text-gray-500">ID: #{facility.id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        facilityTypeColors[facility.type] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {facilityTypeLabels[facility.type] || facility.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{facility.location}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        facility.operational_status?.toUpperCase() === 'OPERATIONAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {facility.operational_status || 'OPERATIONAL'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    <div>{facility.contact_email || '—'}</div>
                    <div>{facility.contact_phone || ''}</div>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenDetails(facility)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Details
                    </button>
                    {canEditFacility && (
                      <button
                        onClick={() => handleOpenEdit(facility)}
                        className="text-xs text-gray-500 hover:text-gray-800"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredAndSortedFacilities.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              data-testid="facility-page-size"
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
              data-testid="facility-prev-page"
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
              data-testid="facility-next-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedFacility && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {selectedFacility.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        facilityTypeColors[selectedFacility.type] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {facilityTypeLabels[selectedFacility.type] || selectedFacility.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedFacility.operational_status === 'OPERATIONAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedFacility.operational_status || 'OPERATIONAL'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Facility ID</span>
                  <span className="font-semibold text-gray-800">#{selectedFacility.id}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">District ID</span>
                  <span className="font-semibold text-gray-800">
                    {selectedFacility.district_id ? `#${selectedFacility.district_id}` : 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Location</span>
                  <span className="font-semibold text-gray-800 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {selectedFacility.location}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Coordinates</span>
                  <span className="font-mono text-xs text-gray-800 flex items-center gap-1.5 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                    {selectedFacility.latitude !== null && selectedFacility.longitude !== null
                      ? `${selectedFacility.latitude.toFixed(4)}, ${selectedFacility.longitude.toFixed(4)}`
                      : 'Coordinates not set'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Email Address</span>
                  <span className="text-gray-800">{selectedFacility.contact_email || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block">Phone Number</span>
                  <span className="text-gray-800">{selectedFacility.contact_phone || 'Not specified'}</span>
                </div>
              </div>

              {/* Facility Services Section */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center justify-between">
                  <span>Available Facility Services</span>
                  <span className="text-xs font-normal text-gray-500">
                    ({facilityServices.length} registered)
                  </span>
                </h3>

                {loadingServices ? (
                  <div className="flex items-center justify-center p-4 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading services...
                  </div>
                ) : facilityServices.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500 border border-gray-100">
                    No individual services recorded for this facility yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {facilityServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs"
                      >
                        <span className="font-medium text-gray-800">{svc.service_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            svc.is_available
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {svc.is_available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  navigate(`/inventory?facility_id=${selectedFacility.id}`);
                }}
                className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
              >
                View Facility Inventory →
              </button>

              <div className="flex items-center gap-2">
                {canEditFacility && (
                  <button
                    onClick={() => handleOpenEdit(selectedFacility)}
                    className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Facility
                  </button>
                )}
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FORM MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900" data-testid="facility-form-title">
                  {formMode === 'create' ? 'Add New Facility' : `Edit ${formData.name}`}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formMode === 'create'
                    ? 'Enter official healthcare facility details.'
                    : 'Update existing facility metadata.'}
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Facility Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Civil Hospital"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  data-testid="facility-name-input"
                  className={`w-full text-sm px-3 py-2 border rounded-lg outline-none transition-colors ${
                    fieldErrors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-primary'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">{fieldErrors.name}</p>
                )}
              </div>

              {/* Type and Operational Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Facility Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(p => ({ ...p, type: e.target.value as FacilityType }))}
                    data-testid="facility-type-select"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    <option value="DISTRICT_HOSPITAL">District Hospital</option>
                    <option value="CIVIL_HOSPITAL">Civil Hospital</option>
                    <option value="CHC">CHC</option>
                    <option value="PHC">PHC</option>
                    <option value="OTHER">Other Facility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formData.operational_status}
                    onChange={(e) => setFormData(p => ({ ...p, operational_status: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white"
                  >
                    <option value="OPERATIONAL">Operational</option>
                    <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Location / Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sector 12, Pune Central"
                  value={formData.location}
                  onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                  data-testid="facility-location-input"
                  className={`w-full text-sm px-3 py-2 border rounded-lg outline-none transition-colors ${
                    fieldErrors.location ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-primary'
                  }`}
                />
                {fieldErrors.location && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">{fieldErrors.location}</p>
                )}
              </div>

              {/* District ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  District ID (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={formData.district_id ?? ''}
                  onChange={(e) =>
                    setFormData(p => ({
                      ...p,
                      district_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              {/* Latitude and Longitude */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Latitude (-90 to 90)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 18.5204"
                    value={formData.latitude ?? ''}
                    onChange={(e) =>
                      setFormData(p => ({
                        ...p,
                        latitude: e.target.value !== '' ? Number(e.target.value) : null,
                      }))
                    }
                    data-testid="facility-latitude-input"
                    className={`w-full text-sm px-3 py-2 border rounded-lg outline-none transition-colors ${
                      fieldErrors.latitude ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-primary'
                    }`}
                  />
                  {fieldErrors.latitude && (
                    <p className="text-red-500 text-[11px] mt-1 font-medium">{fieldErrors.latitude}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Longitude (-180 to 180)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 73.8567"
                    value={formData.longitude ?? ''}
                    onChange={(e) =>
                      setFormData(p => ({
                        ...p,
                        longitude: e.target.value !== '' ? Number(e.target.value) : null,
                      }))
                    }
                    data-testid="facility-longitude-input"
                    className={`w-full text-sm px-3 py-2 border rounded-lg outline-none transition-colors ${
                      fieldErrors.longitude ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-primary'
                    }`}
                  />
                  {fieldErrors.longitude && (
                    <p className="text-red-500 text-[11px] mt-1 font-medium">{fieldErrors.longitude}</p>
                  )}
                </div>
              </div>

              {/* Contact Email and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="admin@hospital.gov"
                    value={formData.contact_email || ''}
                    onChange={(e) => setFormData(p => ({ ...p, contact_email: e.target.value }))}
                    className={`w-full text-sm px-3 py-2 border rounded-lg outline-none transition-colors ${
                      fieldErrors.contact_email ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300 focus:border-primary'
                    }`}
                  />
                  {fieldErrors.contact_email && (
                    <p className="text-red-500 text-[11px] mt-1 font-medium">{fieldErrors.contact_email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 20 1234 5678"
                    value={formData.contact_phone || ''}
                    onChange={(e) => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="facility-is-active"
                  checked={Boolean(formData.is_active)}
                  onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="facility-is-active" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Facility is active and accepting supply allocations
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  data-testid="facility-submit-button"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {formMode === 'create' ? 'Create Facility' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}