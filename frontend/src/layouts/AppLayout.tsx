import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { ToastProvider } from '../components/ui/Toast';

interface AppLayoutProps {
  isCitizen?: boolean;
}

export function AppLayout({ isCitizen = false }: AppLayoutProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* Desktop Sidebar — hidden on mobile */}
        <div className="hidden lg:flex">
          <Sidebar isCitizen={isCitizen} />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar isCitizen={isCitizen} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          </main>

          {/* Mobile bottom nav */}
          <div className="lg:hidden">
            <MobileNav isCitizen={isCitizen} />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
