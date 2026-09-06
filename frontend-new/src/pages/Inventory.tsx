import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package, AlertTriangle, Search, Plus, ArrowUpDown,
  TrendingUp, History, X,
  AlertCircle, ChevronLeft, ChevronRight,
  Loader2, Edit3
} from 'lucide-react';
import { inventoryAPI, stockMovementsAPI, consumptionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils';
import type {
  InventoryItem, StockMovement, ConsumptionRecord,
  ConsumptionSummaryResponse, StockMovementType,
  InventoryCreateInput, InventoryUpdateInput
} from '../types';

const movementTypeStyles: Record<string, { label: string; badge: string; icon: string }> = {
  RECEIVED: { label: 'Received', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '↓' },
  ISSUED: { label: 'Issued', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: '↑' },
  TRANSFERRED_IN: { label: 'Transferred In', badge: 'bg-teal-100 text-teal-800 border-teal-200', icon: '←' },
  TRANSFERRED_OUT: { label: 'Transferred Out', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: '→' },
  ADJUSTMENT: { label: 'Adjustment', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: '±' },
  DAMAGED: { label: 'Damaged', badge: 'bg-red-100 text-red-800 border-red-200', icon: '✕' },
  EXPIRED: { label: 'Expired', badge: 'bg-rose-100 text-rose-800 border-rose-200', icon: '⚠' },
};

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const roleLower = user?.role?.toLowerCase() || '';

  // Role permissions
  const canManageInventory = [
    'super_admin', 'state_admin', 'district_admin', 'hospital_admin', 'facility_staff'
  ].includes(roleLower);

  // Filter states
  const initialFacilityId = searchParams.get('facility_id')
    ? Number(searchParams.get('facility_id'))
    : user?.facility_id || undefined;

  const [facilityId, setFacilityId] = useState<number | undefined>(initialFacilityId);
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'stock' | 'name' | 'expiry' | 'status'>('stock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inventory data state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected item for details
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'movements' | 'consumption'>('details');

  // Movements & Consumption data for selected item
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [consumptionRecords, setConsumptionRecords] = useState<ConsumptionRecord[]>([]);
  const [consumptionSummary, setConsumptionSummary] = useState<ConsumptionSummaryResponse | null>(null);
  const [loadingConsumption, setLoadingConsumption] = useState(false);

  // Modal forms
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);

  // Form states & submission
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});

  // Add Inventory Form State
  const [addFormData, setAddFormData] = useState<InventoryCreateInput>({
    facility_id: initialFacilityId || 1,
    item_name: '',
    category: 'Essential Medicines',
    unit: 'vials',
    current_stock: 50,
    min_threshold: 20,
    max_threshold: 200,
    batch_number: 'BATCH-001',
    expiry_date: '',
  });

  // Edit Inventory Form State
  const [editFormData, setEditFormData] = useState<InventoryUpdateInput>({});

  // Record Stock Movement Form State
  const [movementFormData, setMovementFormData] = useState({
    movement_type: 'RECEIVED' as StockMovementType,
    quantity: 10,
    reference: '',
  });

  // Log Consumption Form State
  const [consumptionFormData, setConsumptionFormData] = useState({
    quantity_consumed: 5,
    record_date: new Date().toISOString().slice(0, 16),
  });

  // Load Inventory List
  useEffect(() => {
    loadInventory();
  }, [facilityId, category, lowStockOnly, searchQuery]);

  const loadInventory = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = {
        limit: 250, // Fetch up to 250 records for responsive client filtering & sorting
      };
      if (facilityId) params.facility_id = facilityId;
      if (category.trim()) params.category = category.trim();
      if (lowStockOnly) params.is_low_stock = true;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const response = await inventoryAPI.list(params);
      setItems(response.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load inventory';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  // Open Details Modal and fetch history
  const handleOpenDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    setActiveTab('details');
    loadItemMovements(item.id, item.facility_id, item.item_id);
    loadItemConsumption(item.facility_id, item.item_id);
  };

  const loadItemMovements = async (invId: number, facId?: number, itmId?: number | null) => {
    setLoadingMovements(true);
    try {
      const res = await inventoryAPI.getMovements(invId);
      setMovements(res.data || []);
    } catch {
      // If movements by inventory ID endpoint fails, try stock movements with params
      try {
        if (facId && itmId) {
          const res = await stockMovementsAPI.list({ facility_id: facId, item_id: itmId });
          setMovements(res.data || []);
        }
      } catch {
        setMovements([]);
      }
    } finally {
      setLoadingMovements(false);
    }
  };

  const loadItemConsumption = async (facId: number, itmId?: number | null) => {
    if (!itmId) return;
    setLoadingConsumption(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        consumptionAPI.list({ facility_id: facId, item_id: itmId, limit: 50 }),
        consumptionAPI.getSummary({ facility_id: facId, item_id: itmId, period: 'daily' }).catch(() => null)
      ]);
      setConsumptionRecords(listRes.data || []);
      if (sumRes) setConsumptionSummary(sumRes.data);
    } catch {
      setConsumptionRecords([]);
      setConsumptionSummary(null);
    } finally {
      setLoadingConsumption(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setAddFormData({
      facility_id: facilityId || user?.facility_id || 1,
      item_name: '',
      category: 'Medicines',
      unit: 'vials',
      current_stock: 50,
      min_threshold: 20,
      max_threshold: 200,
      batch_number: 'BATCH-' + Math.floor(100 + Math.random() * 900),
      expiry_date: '',
    });
    setFormError('');
    setFormFieldErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditFormData({
      current_stock: item.current_stock,
      min_threshold: item.min_threshold,
      max_threshold: item.max_threshold,
      batch_number: item.batch_number || '',
      expiry_date: item.expiry_date ? item.expiry_date.slice(0, 10) : '',
      unit: item.unit,
      item_name: item.item_name || '',
      category: item.category || '',
    });
    setFormError('');
    setFormFieldErrors({});
    setIsEditModalOpen(true);
  };

  // Open Record Movement Modal
  const handleOpenMovementModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementFormData({
      movement_type: 'RECEIVED',
      quantity: 10,
      reference: 'PO-' + Math.floor(1000 + Math.random() * 9000),
    });
    setFormError('');
    setFormFieldErrors({});
    setIsMovementModalOpen(true);
  };

  // Open Log Consumption Modal
  const handleOpenConsumptionModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setConsumptionFormData({
      quantity_consumed: 5,
      record_date: new Date().toISOString().slice(0, 16),
    });
    setFormError('');
    setFormFieldErrors({});
    setIsConsumptionModalOpen(true);
  };

  // Submit Add Inventory
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!addFormData.item_name?.trim()) errors.item_name = 'Item name is required';
    if (!addFormData.facility_id) errors.facility_id = 'Facility ID is required';
    if (addFormData.current_stock < 0) errors.current_stock = 'Stock cannot be negative';
    if (addFormData.min_threshold < 0) errors.min_threshold = 'Min threshold cannot be negative';
    if (addFormData.max_threshold < addFormData.min_threshold) {
      errors.max_threshold = 'Max threshold must be greater than or equal to min threshold';
    }

    if (Object.keys(errors).length > 0) {
      setFormFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload: any = {
        facility_id: Number(addFormData.facility_id),
        item_name: addFormData.item_name?.trim(),
        category: addFormData.category?.trim() || 'Medicines',
        unit: addFormData.unit || 'units',
        current_stock: Number(addFormData.current_stock),
        min_threshold: Number(addFormData.min_threshold),
        max_threshold: Number(addFormData.max_threshold),
        batch_number: addFormData.batch_number || 'BATCH-001',
      };
      if (addFormData.expiry_date) {
        payload.expiry_date = new Date(addFormData.expiry_date).toISOString();
      }

      const res = await inventoryAPI.create(payload);
      setItems(prev => [res.data, ...prev]);
      setIsAddModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create inventory item';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Inventory
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const errors: Record<string, string> = {};
    if (editFormData.current_stock !== undefined && editFormData.current_stock < 0) {
      errors.current_stock = 'Stock cannot be negative';
    }
    if (editFormData.min_threshold !== undefined && editFormData.min_threshold < 0) {
      errors.min_threshold = 'Min threshold cannot be negative';
    }
    if (
      editFormData.max_threshold !== undefined &&
      editFormData.min_threshold !== undefined &&
      editFormData.max_threshold < editFormData.min_threshold
    ) {
      errors.max_threshold = 'Max threshold cannot be less than min threshold';
    }

    if (Object.keys(errors).length > 0) {
      setFormFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload: any = { ...editFormData };
      if (payload.expiry_date) {
        payload.expiry_date = new Date(payload.expiry_date).toISOString();
      }
      const res = await inventoryAPI.update(selectedItem.id, payload);
      setItems(prev => prev.map(item => item.id === selectedItem.id ? res.data : item));
      setSelectedItem(res.data);
      setIsEditModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update item';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Stock Movement
  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (movementFormData.quantity <= 0) {
      setFormFieldErrors({ quantity: 'Quantity must be greater than 0' });
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await stockMovementsAPI.create({
        facility_id: selectedItem.facility_id,
        item_id: selectedItem.item_id || selectedItem.id,
        movement_type: movementFormData.movement_type,
        quantity: Number(movementFormData.quantity),
        reference: movementFormData.reference || 'DIRECT-ENTRY',
        inventory_id: selectedItem.id,
      });

      // Reload inventory & movements
      await loadInventory();
      await loadItemMovements(selectedItem.id, selectedItem.facility_id, selectedItem.item_id);
      setIsMovementModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to record movement';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Consumption Record
  const handleSubmitConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (consumptionFormData.quantity_consumed <= 0) {
      setFormFieldErrors({ quantity_consumed: 'Quantity consumed must be greater than 0' });
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await consumptionAPI.create({
        facility_id: selectedItem.facility_id,
        item_id: selectedItem.item_id || selectedItem.id,
        quantity_consumed: Number(consumptionFormData.quantity_consumed),
        record_date: new Date(consumptionFormData.record_date).toISOString(),
      });

      // Reload inventory & consumption
      await loadInventory();
      await loadItemConsumption(selectedItem.facility_id, selectedItem.item_id);
      setIsConsumptionModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to log consumption';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate Expiry Indicator Helper
  const getExpiryIndicator = (expiryDateStr: string | null) => {
    if (!expiryDateStr) {
      return { label: 'No expiry set', badge: 'bg-gray-100 text-gray-600', icon: '—' };
    }
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Expired (${Math.abs(diffDays)}d ago)`,
        badge: 'bg-red-100 text-red-800 border-red-200 font-bold',
        icon: '⚠',
      };
    } else if (diffDays <= 30) {
      return {
        label: `Critical: ${diffDays}d left`,
        badge: 'bg-red-50 text-red-700 border-red-200 font-semibold',
        icon: '⚠',
      };
    } else if (diffDays <= 90) {
      return {
        label: `Expires in ${diffDays}d`,
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: '⏱',
      };
    } else {
      return {
        label: formatDate(expiryDateStr),
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: '✓',
      };
    }
  };

  // Sorted & Filtered Items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'stock') {
        comp = a.current_stock - b.current_stock;
      } else if (sortBy === 'name') {
        comp = (a.item_name || '').localeCompare(b.item_name || '');
      } else if (sortBy === 'expiry') {
        const timeA = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
        const timeB = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
        comp = timeA - timeB;
      } else if (sortBy === 'status') {
        comp = (a.stock_level || '').localeCompare(b.stock_level || '');
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return result;
  }, [items, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, page, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Inventory & Medical Supplies
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Track live batches, stock thresholds, expiry alerts, and movements.
          </p>
        </div>

        {canManageInventory && (
          <button
            onClick={handleOpenAdd}
            data-testid="add-inventory-button"
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all self-start sm:self-auto text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Stock Item
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Unable to fetch inventory</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadInventory}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1.5 rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search medicine name, code, or batch..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              data-testid="inventory-search-input"
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

          {/* Facility ID Filter */}
          <div>
            <input
              type="number"
              placeholder="Filter by Facility ID"
              value={facilityId ?? ''}
              onChange={(e) => {
                setFacilityId(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              data-testid="inventory-facility-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <input
              type="text"
              placeholder="Filter Category (e.g. Antibiotics)"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              data-testid="inventory-category-filter"
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          {/* Low Stock Toggle & Clear */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer bg-gray-50 hover:bg-gray-100 p-2 rounded-lg border border-gray-200 transition-colors">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => {
                  setLowStockOnly(e.target.checked);
                  setPage(1);
                }}
                data-testid="inventory-low-stock-filter"
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <span>Low Stock Only</span>
            </label>

            <button
              onClick={() => {
                setSearchQuery('');
                setCategory('');
                setFacilityId(undefined);
                setLowStockOnly(false);
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-gray-800 p-2 font-medium"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Sorting and Count Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          <span>
            Total items found: <strong className="text-gray-900">{filteredAndSortedItems.length}</strong>
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
              <option value="stock">Stock Quantity</option>
              <option value="name">Item Name</option>
              <option value="expiry">Expiry Date</option>
              <option value="status">Risk Status</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-primary hover:underline font-semibold uppercase"
            >
              {sortOrder}
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="card p-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-gray-500 text-sm">Fetching live inventory catalog...</p>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-2 border-gray-200">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-800 font-semibold text-lg">No Inventory Records Found</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
            Try adjusting search terms, clearing filters, or adding new items to facility stock.
          </p>
          {canManageInventory && (
            <button
              onClick={handleOpenAdd}
              className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5 px-3 py-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add First Stock Item
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-xs" data-testid="inventory-table">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item & Batch</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Facility</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">Thresholds (Min/Max)</th>
                <th className="py-3 px-4">Expiry Indicator</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedItems.map((item) => {
                const expiry = getExpiryIndicator(item.expiry_date);
                const stockPercentage = Math.min(
                  100,
                  Math.round((item.current_stock / (item.max_threshold || 100)) * 100)
                );

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    {/* Item & Batch */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                        {item.item_name || `Catalog Item #${item.item_id || item.id}`}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.batch_number || 'BATCH-001'}
                        </span>
                        <span>· {item.unit || 'units'}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-xs text-gray-600 font-medium">
                      {item.category || 'General'}
                    </td>

                    {/* Facility */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                        Fac #{item.facility_id}
                      </span>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-gray-900 text-sm">
                        {item.current_stock}
                      </div>
                      {/* Mini Stock Gauge */}
                      <div className="w-20 bg-gray-200 h-1.5 rounded-full ml-auto mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.stock_level === 'critical'
                              ? 'bg-red-500'
                              : item.stock_level === 'low'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${stockPercentage}%` }}
                        />
                      </div>
                    </td>

                    {/* Thresholds */}
                    <td className="py-3 px-4 text-right text-xs text-gray-600 font-mono">
                      <span>{item.min_threshold}</span> / <span>{item.max_threshold}</span>
                    </td>

                    {/* Expiry Indicator */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${expiry.badge}`}
                        data-testid="expiry-badge"
                      >
                        <span>{expiry.icon}</span>
                        <span>{expiry.label}</span>
                      </span>
                    </td>

                    {/* Risk Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                          item.stock_level === 'critical'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : item.stock_level === 'low'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : item.stock_level === 'overstocked'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                        data-testid="risk-badge"
                      >
                        {item.stock_level?.toUpperCase() || (item.is_low_stock ? 'LOW' : 'ADEQUATE')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetails(item)}
                        data-testid={`view-item-${item.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Details
                      </button>

                      {canManageInventory && (
                        <>
                          <button
                            onClick={() => handleOpenMovementModal(item)}
                            title="Record Stock Movement"
                            data-testid={`movement-btn-${item.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1"
                          >
                            +Movement
                          </button>
                          <button
                            onClick={() => handleOpenConsumptionModal(item)}
                            title="Log Consumption"
                            data-testid={`consumption-btn-${item.id}`}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium ml-1"
                          >
                            +Log Use
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Item"
                            data-testid={`edit-item-${item.id}`}
                            className="text-xs text-gray-500 hover:text-gray-800 ml-1"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredAndSortedItems.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              data-testid="inventory-page-size"
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={5}>5 items</option>
              <option value={10}>10 items</option>
              <option value={20}>20 items</option>
              <option value={50}>50 items</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="inventory-prev-page"
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
              data-testid="inventory-next-page"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* DETAILS MODAL WITH STOCK MOVEMENTS AND CONSUMPTION HISTORY */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {selectedItem.item_name || `Item #${selectedItem.id}`}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 font-mono">
                      Batch: {selectedItem.batch_number || 'N/A'}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">
                      Facility #{selectedItem.facility_id}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        selectedItem.stock_level === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : selectedItem.stock_level === 'low'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {selectedItem.stock_level?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 px-6 gap-6 bg-gray-50 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('details')}
                data-testid="tab-details"
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Stock Overview
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                data-testid="tab-movements"
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'movements'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Movement History ({movements.length})
              </button>
              <button
                onClick={() => setActiveTab('consumption')}
                data-testid="tab-consumption"
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === 'consumption'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Consumption History ({consumptionRecords.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {activeTab === 'details' && (
                <div className="space-y-5">
                  {/* Gauge Overview */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                      <span>Stock Threshold Gauge</span>
                      <span className="font-mono text-primary font-bold">
                        {selectedItem.current_stock} / {selectedItem.max_threshold} {selectedItem.unit}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selectedItem.stock_level === 'critical'
                            ? 'bg-red-500'
                            : selectedItem.stock_level === 'low'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((selectedItem.current_stock / (selectedItem.max_threshold || 100)) * 100)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 font-mono">
                      <span>Min: {selectedItem.min_threshold} {selectedItem.unit}</span>
                      <span>Target: ~{(selectedItem.min_threshold + selectedItem.max_threshold) / 2}</span>
                      <span>Max: {selectedItem.max_threshold} {selectedItem.unit}</span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-white p-4 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-gray-400 block font-medium">Category</span>
                      <span className="font-semibold text-gray-800">{selectedItem.category || 'General'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Batch Code</span>
                      <span className="font-semibold font-mono text-gray-800">
                        {selectedItem.batch_number || 'BATCH-001'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Unit Type</span>
                      <span className="font-semibold text-gray-800">{selectedItem.unit || 'units'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Expiry Date</span>
                      <span className="font-semibold text-gray-800">
                        {selectedItem.expiry_date ? formatDate(selectedItem.expiry_date) : 'No date set'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Created On</span>
                      <span className="font-semibold text-gray-800">
                        {selectedItem.created_at ? formatDate(selectedItem.created_at) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Last Updated</span>
                      <span className="font-semibold text-gray-800">
                        {selectedItem.last_updated || selectedItem.updated_at
                          ? formatDate(selectedItem.last_updated || selectedItem.updated_at!)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Shortcuts */}
                  {canManageInventory && (
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => handleOpenMovementModal(selectedItem)}
                        className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Record Stock Movement
                      </button>
                      <button
                        onClick={() => handleOpenConsumptionModal(selectedItem)}
                        className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
                      >
                        <TrendingUp className="w-3.5 h-3.5" /> Log Consumption
                      </button>
                      <button
                        onClick={() => handleOpenEdit(selectedItem)}
                        className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Thresholds
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STOCK MOVEMENT HISTORY */}
              {activeTab === 'movements' && (
                <div className="space-y-4" data-testid="movements-history-tab">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      Audit Trail & Movement History
                    </h3>
                    {canManageInventory && (
                      <button
                        onClick={() => handleOpenMovementModal(selectedItem)}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        + Add Movement
                      </button>
                    )}
                  </div>

                  {loadingMovements ? (
                    <div className="p-8 flex items-center justify-center text-sm text-gray-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Loading stock movements...
                    </div>
                  ) : movements.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                      No stock movement events recorded for this inventory yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {movements.map((m) => {
                            const style = movementTypeStyles[m.movement_type] || {
                              label: m.movement_type,
                              badge: 'bg-gray-100 text-gray-700',
                              icon: '•',
                            };
                            return (
                              <tr key={m.id} className="hover:bg-gray-50">
                                <td className="py-2 px-3 text-gray-600 font-mono">
                                  {formatDate(m.created_at)}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-semibold border ${style.badge}`}
                                  >
                                    <span className="mr-1">{style.icon}</span>
                                    <span>{style.label}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                                  {m.quantity}
                                </td>
                                <td className="py-2 px-3 text-gray-600 font-mono">
                                  {m.reference || '—'}
                                </td>
                                <td className="py-2 px-3 text-gray-500">
                                  {m.user_name || (m.created_by_user_id ? `User #${m.created_by_user_id}` : 'System')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CONSUMPTION HISTORY */}
              {activeTab === 'consumption' && (
                <div className="space-y-4" data-testid="consumption-history-tab">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">
                      Historical Resource Consumption
                    </h3>
                    {canManageInventory && (
                      <button
                        onClick={() => handleOpenConsumptionModal(selectedItem)}
                        className="text-xs text-teal-600 hover:underline font-semibold"
                      >
                        + Log Consumption
                      </button>
                    )}
                  </div>

                  {/* Summary Metric Cards */}
                  {consumptionSummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-teal-50/50 p-3 rounded-xl border border-teal-100 text-xs">
                      <div>
                        <span className="text-teal-700 block font-medium">Total Consumed</span>
                        <span className="text-lg font-bold text-teal-950 font-mono">
                          {consumptionSummary.total_consumed} {selectedItem.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-700 block font-medium">Period Type</span>
                        <span className="font-semibold text-teal-900 capitalize">
                          {consumptionSummary.period}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-700 block font-medium">Logged Entries</span>
                        <span className="font-bold text-teal-950 font-mono">
                          {consumptionRecords.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {loadingConsumption ? (
                    <div className="p-8 flex items-center justify-center text-sm text-gray-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      Loading consumption records...
                    </div>
                  ) : consumptionRecords.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                      No consumption records logged for this item yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Date Consumed</th>
                            <th className="py-2.5 px-3 text-right">Quantity Consumed</th>
                            <th className="py-2.5 px-3">Logged At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {consumptionRecords.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-900 font-mono font-medium">
                                {formatDate(c.record_date)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                                {c.quantity_consumed} {selectedItem.unit}
                              </td>
                              <td className="py-2 px-3 text-gray-500 font-mono">
                                {formatDate(c.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD INVENTORY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900" data-testid="add-inventory-modal-title">
                  Add Stock Item
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allocate new inventory or batches to a healthcare facility.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol 500mg"
                  value={addFormData.item_name || ''}
                  onChange={(e) => setAddFormData(p => ({ ...p, item_name: e.target.value }))}
                  data-testid="add-item-name"
                  className={`w-full text-sm px-3 py-2 border rounded-lg outline-none ${
                    formFieldErrors.item_name ? 'border-red-500' : 'border-gray-300 focus:border-primary'
                  }`}
                />
                {formFieldErrors.item_name && (
                  <p className="text-red-500 text-[11px] mt-1">{formFieldErrors.item_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Facility ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={addFormData.facility_id}
                    onChange={(e) => setAddFormData(p => ({ ...p, facility_id: Number(e.target.value) }))}
                    data-testid="add-facility-id"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Antibiotics"
                    value={addFormData.category || ''}
                    onChange={(e) => setAddFormData(p => ({ ...p, category: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Current Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={addFormData.current_stock}
                    onChange={(e) => setAddFormData(p => ({ ...p, current_stock: Number(e.target.value) }))}
                    data-testid="add-current-stock"
                    className={`w-full text-sm px-3 py-2 border rounded-lg outline-none ${
                      formFieldErrors.current_stock ? 'border-red-500' : 'border-gray-300 focus:border-primary'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Min Threshold <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={addFormData.min_threshold}
                    onChange={(e) => setAddFormData(p => ({ ...p, min_threshold: Number(e.target.value) }))}
                    data-testid="add-min-threshold"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Threshold <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={addFormData.max_threshold}
                    onChange={(e) => setAddFormData(p => ({ ...p, max_threshold: Number(e.target.value) }))}
                    data-testid="add-max-threshold"
                    className={`w-full text-sm px-3 py-2 border rounded-lg outline-none ${
                      formFieldErrors.max_threshold ? 'border-red-500' : 'border-gray-300 focus:border-primary'
                    }`}
                  />
                </div>
              </div>
              {formFieldErrors.max_threshold && (
                <p className="text-red-500 text-[11px]">{formFieldErrors.max_threshold}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={addFormData.batch_number || ''}
                    onChange={(e) => setAddFormData(p => ({ ...p, batch_number: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Unit Type
                  </label>
                  <input
                    type="text"
                    placeholder="vials, boxes, units"
                    value={addFormData.unit || ''}
                    onChange={(e) => setAddFormData(p => ({ ...p, unit: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={addFormData.expiry_date || ''}
                  onChange={(e) => setAddFormData(p => ({ ...p, expiry_date: e.target.value }))}
                  data-testid="add-expiry-date"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="add-inventory-submit"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD STOCK MOVEMENT MODAL */}
      {isMovementModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900" data-testid="movement-modal-title">
                  Record Stock Movement
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedItem.item_name} · Facility #{selectedItem.facility_id}
                </p>
              </div>
              <button
                onClick={() => setIsMovementModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitMovement} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Movement Type
                </label>
                <select
                  value={movementFormData.movement_type}
                  onChange={(e) =>
                    setMovementFormData(p => ({
                      ...p,
                      movement_type: e.target.value as StockMovementType,
                    }))
                  }
                  data-testid="movement-type-select"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary bg-white font-medium"
                >
                  <option value="RECEIVED">RECEIVED (Inbound stock)</option>
                  <option value="ISSUED">ISSUED (Dispensed / Used)</option>
                  <option value="TRANSFERRED_IN">TRANSFERRED_IN</option>
                  <option value="TRANSFERRED_OUT">TRANSFERRED_OUT</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (Audit correction)</option>
                  <option value="DAMAGED">DAMAGED (Write-off)</option>
                  <option value="EXPIRED">EXPIRED (Disposal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quantity ({selectedItem.unit || 'units'}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={movementFormData.quantity}
                  onChange={(e) =>
                    setMovementFormData(p => ({ ...p, quantity: Number(e.target.value) }))
                  }
                  data-testid="movement-quantity-input"
                  className={`w-full text-sm px-3 py-2 border rounded-lg outline-none ${
                    formFieldErrors.quantity ? 'border-red-500' : 'border-gray-300 focus:border-primary'
                  }`}
                />
                {formFieldErrors.quantity && (
                  <p className="text-red-500 text-[11px] mt-1">{formFieldErrors.quantity}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reference / Batch ID / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-8492 or Dispatch #12"
                  value={movementFormData.reference}
                  onChange={(e) =>
                    setMovementFormData(p => ({ ...p, reference: e.target.value }))
                  }
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="movement-submit-button"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG CONSUMPTION MODAL */}
      {isConsumptionModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900" data-testid="consumption-modal-title">
                  Log Resource Consumption
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Record patient dispensing or procedure usage for AI demand tracking.
                </p>
              </div>
              <button
                onClick={() => setIsConsumptionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitConsumption} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Quantity Consumed ({selectedItem.unit || 'units'}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={consumptionFormData.quantity_consumed}
                  onChange={(e) =>
                    setConsumptionFormData(p => ({
                      ...p,
                      quantity_consumed: Number(e.target.value),
                    }))
                  }
                  data-testid="consumption-quantity-input"
                  className={`w-full text-sm px-3 py-2 border rounded-lg outline-none ${
                    formFieldErrors.quantity_consumed ? 'border-red-500' : 'border-gray-300 focus:border-primary'
                  }`}
                />
                {formFieldErrors.quantity_consumed && (
                  <p className="text-red-500 text-[11px] mt-1">{formFieldErrors.quantity_consumed}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Usage Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={consumptionFormData.record_date}
                  onChange={(e) =>
                    setConsumptionFormData(p => ({ ...p, record_date: e.target.value }))
                  }
                  data-testid="consumption-date-input"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConsumptionModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="consumption-submit-button"
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Record Consumption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVENTORY MODAL */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900" data-testid="edit-item-modal-title">
                  Edit Stock Thresholds
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update buffer levels and batch data for #{selectedItem.id}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Current Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.current_stock ?? ''}
                  onChange={(e) =>
                    setEditFormData(p => ({ ...p, current_stock: Number(e.target.value) }))
                  }
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.min_threshold ?? ''}
                    onChange={(e) =>
                      setEditFormData(p => ({ ...p, min_threshold: Number(e.target.value) }))
                    }
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.max_threshold ?? ''}
                    onChange={(e) =>
                      setEditFormData(p => ({ ...p, max_threshold: Number(e.target.value) }))
                    }
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.batch_number || ''}
                    onChange={(e) =>
                      setEditFormData(p => ({ ...p, batch_number: e.target.value }))
                    }
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.expiry_date || ''}
                    onChange={(e) =>
                      setEditFormData(p => ({ ...p, expiry_date: e.target.value }))
                    }
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}