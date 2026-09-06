import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

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

    setIsLoading(true);

    try {
      await register(email, password, fullName);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
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

        {/* Main Glassmorphic Register Card */}
        <div className="bg-slate-100/95 backdrop-blur-md rounded-3xl shadow-2xl p-7 border border-white/20 animate-fade-in">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">Create Account</h2>
            <p className="text-xs text-slate-500 mt-1">Register for a new citizen access account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2 shadow-sm">
              <span className="shrink-0 font-bold">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* FULL NAME */}
            <div>
              <label htmlFor="register-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
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
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* EMAIL OR NATIONAL ID */}
            <div>
              <label htmlFor="register-email" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                EMAIL ADDRESS
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
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label htmlFor="register-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                PASSWORD
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="••••••••••••"
                  required
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

            {/* CONFIRM PASSWORD */}
            <div>
              <label htmlFor="register-confirm-password" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Create Account</span>
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
