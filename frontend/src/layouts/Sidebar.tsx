import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Package,
  Bell,
  TrendingUp,
  ArrowLeftRight,
  Wrench,
  Bot,
  Users,
  Circle,
  LogOut,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { NiramayaLogo } from '../assets/Logo';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

const govNavItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/facilities', icon: <Building2 size={18} />, label: 'Facilities' },
  { to: '/inventory', icon: <Package size={18} />, label: 'Inventory' },
  { to: '/alerts', icon: <Bell size={18} />, label: 'Alerts', badge: 18 },
  { to: '/predictions', icon: <TrendingUp size={18} />, label: 'Predictions' },
  { to: '/recommendations', icon: <ArrowLeftRight size={18} />, label: 'Redistribution' },
  { to: '/equipment', icon: <Wrench size={18} />, label: 'Equipment' },
  { to: '/ai-assistant', icon: <Bot size={18} />, label: 'AI Assistant' },
  { to: '/approvals', icon: <UserCheck size={18} />, label: 'Approvals' },
  { to: '/citizen', icon: <Users size={18} />, label: 'Citizen Portal' },
];

const citizenNavItems: NavItem[] = [
  { to: '/citizen', icon: <Building2 size={18} />, label: 'Facilities' },
  { to: '/citizen/assistant', icon: <Bot size={18} />, label: 'AI Assistant' },
];

interface SidebarProps {
  isCitizen?: boolean;
}

// Helper to determine if an item is visible for a role
function isItemVisible(to: string, role: string): boolean {
  if (['SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN'].includes(role)) {
    return true; // These admins see everything
  }
  
  if (role === 'HOSPITAL_ADMIN') {
    return !['/facilities', '/predictions', '/approvals'].includes(to);
  }
  
  if (role === 'FACILITY_STAFF') {
    return !['/facilities', '/predictions', '/recommendations', '/approvals'].includes(to);
  }
  
  return true;
}

export function Sidebar({ isCitizen = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Filter navigation items
  const navItems = isCitizen 
    ? citizenNavItems 
    : govNavItems.filter(item => user ? isItemVisible(item.to, user.role) : false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 flex flex-col h-screen bg-[#0D1526] border-r border-white/5 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <NiramayaLogo variant="sidebar" size={32} />
        {!isCitizen && (
          <div className="mt-3 text-[10px] text-blue-400/60 tracking-widest uppercase">
            Public Healthcare Intelligence
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Main navigation">
        <div className="px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/citizen'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-900/20'
                    : 'text-blue-200/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-white' : 'text-blue-300/60 group-hover:text-blue-300'}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight size={14} className="text-white/50" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom area */}
      <div className="border-t border-white/5 px-3 py-3 space-y-1">
        {/* System status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
          <div className="relative">
            <Circle size={8} fill="#22C55E" className="text-green-500" />
            <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
          </div>
          <span className="text-[11px] text-green-400 font-medium">System Operational</span>
        </div>

        {/* User profile */}
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user.name}</div>
              <div className="text-blue-300/50 text-[10px] truncate">{user.role.replace('_', ' ')}</div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-blue-200/50 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          aria-label="Logout"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
