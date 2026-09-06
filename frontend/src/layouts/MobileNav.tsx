import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Bot, User } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

interface MobileNavProps {
  isCitizen?: boolean;
}

const govItems = [
  { to: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'Home' },
  { to: '/inventory', icon: <Package size={22} />, label: 'Supply' },
  { to: '/ai-assistant', icon: <Bot size={22} />, label: 'AI Intel' },
  { to: '/citizen', icon: <User size={22} />, label: 'Portal' },
];

const citizenItems = [
  { to: '/citizen', icon: <LayoutDashboard size={22} />, label: 'Home' },
  { to: '/citizen/assistant', icon: <Bot size={22} />, label: 'AI Intel' },
];

export function MobileNav({ isCitizen = false }: MobileNavProps) {
  const { user } = useAuth();
  
// Minimal set of mobile items, filtered by role
  const items = isCitizen 
    ? citizenItems 
    : govItems.filter(_item => {
        if (!user) return false;
        // Specific checks if needed (all 4 current govItems are accessible to all gov roles)
        return true;
      });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around z-40 h-16 px-2"
      aria-label="Mobile navigation"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/citizen'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? 'text-blue-600' : ''}>{item.icon}</span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
