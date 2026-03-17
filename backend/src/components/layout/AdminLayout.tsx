import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { DashboardTabProvider } from '@/contexts/DashboardTabContext';
import { TimeFilterProvider } from '@/contexts/TimeFilterContext';
import { cn } from '@/lib/utils';

export const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <DashboardTabProvider>
    <TimeFilterProvider>
    <div className="min-h-screen bg-background">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className={cn(
        "lg:block",
        mobileMenuOpen ? "block" : "hidden"
      )}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      <div
        className={cn(
          "flex flex-col h-screen min-h-0 transition-all duration-300 ease-out",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <TopBar onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6 page-content flex flex-col">
          <div className="min-w-max w-full flex-1">
            <Outlet />
          </div>
          <footer className="py-2 text-center text-xs text-muted-foreground border-t border-border mt-4">
            New Idea, NO.1 Production
          </footer>
        </main>
      </div>
    </div>
    </TimeFilterProvider>
    </DashboardTabProvider>
  );
};
