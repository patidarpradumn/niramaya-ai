import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Lock, Mail, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils';

interface RoleOption {
  id: string;
  label: string;
  roleName: string;
}

const ROLES: RoleOption[] = [
  { id: 'SUPER_ADMIN', label: 'Super Admin', roleName: 'Super Admin' },
  { id: 'STATE_ADMIN', label: 'State Admin', roleName: 'State Admin' },
  { id: 'DISTRICT_ADMIN', label: 'District Admin', roleName: 'District Admin' },
  { id: 'HOSPITAL_ADMIN', label: 'Hospital', roleName: 'Hospital Admin' },
  { id: 'FACILITY_STAFF', label: 'Staff', roleName: 'Facility Staff' },
  { id: 'CITIZEN', label: 'Citizen', roleName: 'Citizen' },
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<string>('CITIZEN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricActive, setIsBiometricActive] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      const target = selectedRole === 'CITIZEN' ? '/citizen' : '/dashboard';
      navigate(target);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsBiometricActive(true);
    setError('');
    // Simulate biometric scan
    setTimeout(async () => {
      try {
        await login(email, password);
        const target = selectedRole === 'CITIZEN' ? '/citizen' : '/dashboard';
        navigate(target);
      } catch (err) {
        setError('Biometric authentication failed. Please enter your password.');
        setIsBiometricActive(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#070D1B] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-[#070D1B] to-[#040812] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Header & Logo */}
        <div className="text-center mb-6 animate-fade-in">
          {/* Logo Badge */}
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

        {/* Main Glassmorphic Login Card */}
        <div className="bg-slate-100/95 backdrop-blur-md rounded-3xl shadow-2xl p-7 border border-white/20 animate-fade-in">
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
                SELECT ACCESS ROLE
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleSelect(role.id)}
                      className={`py-2 px-2 text-xs font-semibold rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                          : 'bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 border-transparent'
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EMAIL OR NATIONAL ID */}
            <div>
              <label htmlFor="login-email" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                EMAIL OR NATIONAL ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="name@gov.in or ID"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  PASSWORD
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); setError('Please contact system administrator to reset credentials.'); }} className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="••••••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Encrypted Badge */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-600">Remember this device</span>
              </label>

              <div className="px-2 py-0.5 bg-amber-100/90 border border-amber-300/60 rounded-md flex items-center gap-1 text-[10px] font-semibold text-amber-800 shadow-2xs">
                <Shield className="w-3 h-3 text-amber-700" />
                <span>Encrypted</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isBiometricActive}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isLoading || isBiometricActive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isBiometricActive ? 'Authenticating Biometrics...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Secure Login</span>
                </>
              )}
            </button>
          </form>

          {/* Biometrics Option */}
          <div className="mt-5 text-center pt-2">
            <p className="text-[11px] font-medium text-slate-400 mb-2.5">
              Or sign in instantly with biometrics
            </p>
            <button
              type="button"
              onClick={handleBiometricAuth}
              disabled={isBiometricActive || isLoading}
              title="Biometric Fingerprint Authentication"
              className="mx-auto w-11 h-11 rounded-2xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-600 flex items-center justify-center transition-all shadow-sm border border-blue-100/80 cursor-pointer group"
            >
              <Fingerprint className={`w-5 h-5 transition-transform group-hover:scale-110 ${isBiometricActive ? 'animate-pulse text-blue-700' : ''}`} />
            </button>
          </div>
          
          {/* Sign Up Link */}
          <div className="mt-6 text-center border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500 font-medium">
              New to Niramaya AI?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-slate-400">
          <p className="text-xs font-medium text-slate-400/90 tracking-wide mb-1">
            Ministry of Health & Family Welfare • Secure Portal
          </p>
          <div className="text-[11px] text-slate-500 font-normal space-x-3">
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#help" className="hover:text-slate-300 transition-colors">Help Desk</a>
            <span>•</span>
            <a href="#status" className="hover:text-slate-300 transition-colors">System Status</a>
          </div>
        </div>
      </div>
    </div>
  );
}