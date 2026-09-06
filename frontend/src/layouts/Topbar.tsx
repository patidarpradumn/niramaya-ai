import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, X, Circle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/facilities': 'Supply Chain',
  '/inventory': 'Inventory',
  '/alerts': 'Alert Center',
  '/predictions': 'Ai Insights',
  '/recommendations': 'Redistribution',
  '/equipment': 'Equipment',
  '/ai-assistant': 'Ai Assistant',
  '/citizen': 'Public Portal',
  '/citizen/assistant': 'Ai Assistant',
};

function getTitle(pathname: string): string {
  if (pathname.startsWith('/facilities/')) return 'Facility Details';
  return ROUTE_TITLES[pathname] || 'NIRAMAYA AI';
}

interface TopbarProps {
  isCitizen?: boolean;
}

export function Topbar({ isCitizen = false }: TopbarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const title = getTitle(location.pathname);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0 z-30">
      {/* Mobile menu button — placeholder (sidebar is hidden on mobile, MobileNav handles it) */}
      <div className="lg:hidden w-8" />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-800 truncate">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search facilities, resources..."
              className="bg-transparent text-sm outline-none w-48 text-gray-700 placeholder-gray-400"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
            <button onClick={() => setSearchOpen(false)}>
              <X size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
        )}

        {/* AI Status — only for government users */}
        {!isCitizen && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="relative">
              <Circle size={7} fill="#14B8A6" className="text-teal-500" />
              <div className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-50" />
            </div>
            <span className="text-xs text-teal-700 font-medium">AI Active</span>
          </div>
        )}

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {!isCitizen && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* User avatar */}
        {user && (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all" aria-label={`User: ${user.name}`}>
            {user.name.charAt(0)}
          </div>
        )}
      </div>
    </header>
  );
}
