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
      <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
        {/* Desktop Sidebar — hidden on mobile */}
        <div className="hidden lg:flex">
          <Sidebar isCitizen={isCitizen} />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar isCitizen={isCitizen} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
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
