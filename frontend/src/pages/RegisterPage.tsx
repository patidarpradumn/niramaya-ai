import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Lock, Mail, User, Globe, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api/authService';
import { getErrorMessage } from '../utils';
import type { UserRole } from '../types';

export default function Register() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('CITIZEN');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Dynamic Geographic State
  const [states, setStates] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ id: number; name: string; state_id: number }>>([]);
  const [facilities, setFacilities] = useState<Array<{ id: number; name: string; type: string; location: string; district_id: number }>>([]);

  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | ''>('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | ''>('');
  const [loadingGeo, setLoadingGeo] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Load States on mount
  useEffect(() => {
    async function loadStates() {
      try {
        const stateList = await authAPI.getStates();
        setStates(stateList);
      } catch (e) {
        console.error('Failed to load states:', e);
      }
    }
    loadStates();
  }, []);

  // Load Districts when state changes
  useEffect(() => {
    async function loadDistricts() {
      if (!selectedStateId) {
        setDistricts([]);
        setSelectedDistrictId('');
        return;
      }
      setLoadingGeo(true);
      try {
        const distList = await authAPI.getDistricts(Number(selectedStateId));
        setDistricts(distList);
        setSelectedDistrictId('');
        setSelectedFacilityId('');
      } catch (e) {
        console.error('Failed to load districts:', e);
      } finally {
        setLoadingGeo(false);
      }
    }
    loadDistricts();
  }, [selectedStateId]);

  // Load Facilities when district or state changes
  useEffect(() => {
    async function loadFacilities() {
      if (!selectedDistrictId && !selectedStateId) {
        setFacilities([]);
        setSelectedFacilityId('');
        return;
      }
      setLoadingGeo(true);
      try {
        const facList = await authAPI.getFacilitiesList({
          district_id: selectedDistrictId ? Number(selectedDistrictId) : undefined,
          state_id: selectedStateId ? Number(selectedStateId) : undefined,
        });
        setFacilities(facList);
        setSelectedFacilityId('');
      } catch (e) {
        console.error('Failed to load facilities:', e);
      } finally {
        setLoadingGeo(false);
      }
    }
    loadFacilities();
  }, [selectedDistrictId, selectedStateId]);

  const handleRoleSelect = (roleId: UserRole) => {
    setSelectedRole(roleId);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Role-specific validation
    if (selectedRole === 'STATE_ADMIN' && !selectedStateId) {
      setError('Please select your assigned State');
      return;
    }

    if (selectedRole === 'DISTRICT_ADMIN' && (!selectedStateId || !selectedDistrictId)) {
      setError('Please select both State and District for District Admin registration');
      return;
    }

    if ((selectedRole === 'HOSPITAL_ADMIN' || selectedRole === 'FACILITY_STAFF') && !selectedFacilityId) {
      setError('Please select the Healthcare Facility you are managing');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, fullName, selectedRole, {
        state_id: selectedStateId ? Number(selectedStateId) : undefined,
        district_id: selectedDistrictId ? Number(selectedDistrictId) : undefined,
        facility_id: selectedFacilityId ? Number(selectedFacilityId) : undefined,
      });

      if (selectedRole === 'CITIZEN' || selectedRole === 'SUPER_ADMIN') {
        navigate('/dashboard');
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Pending')) {
        setIsSuccess(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#070D1B] flex flex-col items-center justify-center p-4">
        <div className="bg-slate-100/95 rounded-3xl shadow-2xl p-7 border border-white/20 text-center max-w-md w-full animate-fade-in">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Account Registered</h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            Your official <strong className="text-blue-600">{selectedRole.replace('_', ' ')}</strong> profile has been registered in the Niramaya AI national healthcare network.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/20 text-sm cursor-pointer"
            >
              Continue to Dashboard
            </button>
            <Link to="/login" className="block text-xs font-semibold text-slate-500 hover:text-slate-700">
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D1B] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-[#070D1B] to-[#040812] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Top Header & Logo */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-3 shadow-lg shadow-blue-500/25 border border-blue-400/30">
            <span className="text-2xl font-black text-white tracking-tighter">N</span>
          </div>

          <h1 className="text-2xl font-bold tracking-[0.2em] text-white font-serif uppercase">
            NIRAMAYA AI
          </h1>
          <p className="text-[10px] tracking-[0.25em] text-blue-300/80 font-medium uppercase mt-1">
            INTELLIGENCE FOR A HEALTHIER NATION
          </p>
        </div>

        {/* Main Glassmorphic Register Card */}
        <div className="bg-slate-100/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 animate-fade-in">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">Create Official Account</h2>
            <p className="text-xs text-slate-500 mt-1">Select your administrative role and jurisdiction</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2 shadow-sm">
              <span className="shrink-0 font-bold">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SELECT ACCESS ROLE */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                SELECT ACCOUNT ROLE
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { id: 'SUPER_ADMIN', label: 'Super Admin' },
                  { id: 'STATE_ADMIN', label: 'State Admin' },
                  { id: 'DISTRICT_ADMIN', label: 'District Admin' },
                  { id: 'HOSPITAL_ADMIN', label: 'Hospital Admin' },
                  { id: 'FACILITY_STAFF', label: 'Facility Staff' },
                  { id: 'CITIZEN', label: 'Citizen' },
                ].map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role.id as UserRole)}
                    className={`py-2 px-2 text-[11px] font-semibold rounded-xl transition-all cursor-pointer border ${
                      selectedRole === role.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                        : 'bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 border-transparent'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DYNAMIC JURISDICTION SELECTORS */}
            {(selectedRole === 'STATE_ADMIN' || selectedRole === 'DISTRICT_ADMIN' || selectedRole === 'HOSPITAL_ADMIN' || selectedRole === 'FACILITY_STAFF') && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3 animate-fade-in">
                <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Jurisdiction Details</span>
                </div>

                {/* State Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    State Jurisdiction *
                  </label>
                  <select
                    value={selectedStateId}
                    onChange={(e) => setSelectedStateId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Select State --</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                {/* District Dropdown */}
                {(selectedRole === 'DISTRICT_ADMIN' || selectedRole === 'HOSPITAL_ADMIN' || selectedRole === 'FACILITY_STAFF') && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      District Jurisdiction *
                    </label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!selectedStateId || loadingGeo}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      required
                    >
                      <option value="">-- Select District --</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Facility Dropdown */}
                {(selectedRole === 'HOSPITAL_ADMIN' || selectedRole === 'FACILITY_STAFF') && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Assigned Hospital / Facility *
                    </label>
                    <select
                      value={selectedFacilityId}
                      onChange={(e) => setSelectedFacilityId(e.target.value ? Number(e.target.value) : '')}
                      disabled={(!selectedDistrictId && !selectedStateId) || loadingGeo}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      required
                    >
                      <option value="">-- Select Facility --</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.location})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* FULL NAME */}
            <div>
              <label htmlFor="register-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                FULL NAME
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="register-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  required
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label htmlFor="register-email" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                OFFICIAL / ACCOUNT EMAIL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="officer@niramaya.gov.in"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="register-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  PASSWORD
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-9 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="register-confirm-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Register {selectedRole.replace('_', ' ')}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-slate-400">
          <p className="text-xs font-medium text-slate-400/90 tracking-wide mb-1">
            Ministry of Health & Family Welfare • Secure Portal
          </p>
        </div>
      </div>
    </div>
  );
}
