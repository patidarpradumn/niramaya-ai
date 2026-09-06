import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  TrendingUp,
  Bot,
  LogOut,
  Menu,
  X,
  Building2,
  User as UserIcon,
  ArrowLeftRight,
  Wrench,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaff, canViewAuditLogs, formatRole } from '../utils';
import type { UserRole } from '../types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  /** If set, only show this nav item for roles that pass this check */
  access?: (role: UserRole) => boolean;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/facilities', label: 'Facilities', icon: Building2 },
  { path: '/inventory', label: 'Inventory', icon: Package, access: isStaff },
  { path: '/alerts', label: 'Alerts', icon: AlertTriangle, access: isStaff },
  { path: '/predictions', label: 'Predictions', icon: TrendingUp, access: isStaff },
  { path: '/recommendations', label: 'Recommendations', icon: ArrowLeftRight, access: isStaff },
  { path: '/equipment', label: 'Equipment', icon: Wrench, access: isStaff },
  { path: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { path: '/audit-logs', label: 'Audit Logs', icon: ScrollText, access: canViewAuditLogs },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userRole = user?.role ?? 'citizen';

  const visibleNavItems = navItems.filter(
    (item) => !item.access || item.access(userRole)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-surface border-r border-border transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md font-bold text-white text-lg">
                N
              </div>
              <span className="font-bold text-lg text-text-primary tracking-wide">NIRAMAYA AI</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user?.full_name}</p>
                <p className="text-xs text-text-secondary truncate">{formatRole(userRole)}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error rounded-lg hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-text-secondary">{user?.email}</span>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-primary" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}