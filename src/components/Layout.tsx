import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  CheckSquare,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  Zap,
  PlusCircle,
  FileDown,
  Globe,
} from 'lucide-react';
import { cn } from '../utils/cn';
import Button from './Button';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Search, label: 'Lead Finder', path: '/finder' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: Mail, label: 'Outreach', path: '/outreach' },
    { icon: CheckSquare, label: 'Deals', path: '/deals' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  const quickActions = [
    { icon: PlusCircle, label: 'Add Lead' },
    { icon: FileDown, label: 'Import' },
    { icon: Mail, label: 'Outreach' },
    { icon: Globe, label: 'Demo' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-72 z-50 lg:z-0 transition-transform duration-300 lg:translate-x-0 bg-[var(--card-bg)]/92 backdrop-blur-2xl',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          boxShadow:
            '8px 0 30px rgba(15, 23, 42, 0.06), 2px 0 10px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 px-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[var(--accent)] shadow-[0_12px_30px_rgba(255,122,0,0.25)]">
              <Zap className="text-white" size={22} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-secondary)] mb-1">
                Internal
              </p>
              <span className="text-2xl font-black tracking-tight">ClientRadar</span>
            </div>
          </div>

          <nav className="flex-1 space-y-3">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 group',
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-[0_16px_30px_rgba(255,122,0,0.28)]'
                      : 'text-[var(--text-secondary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon size={19} />
                  <span className="font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.02] border border-black/8 dark:border-white/6 px-4 py-4 shadow-[var(--surface-shadow-soft)] transition-colors duration-300">
              <p className="text-sm font-semibold mb-1 text-[var(--text-primary)]">
                Lead Engine Active
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Timigaga internal CRM system
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-72 min-h-screen">
        <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-4 bg-[var(--bg)]/80 backdrop-blur-2xl surface-divider">
          <div className="flex items-center justify-between gap-4">
            <button
              className="lg:hidden rounded-xl bg-white/5 border border-white/8 p-2.5 transition-colors hover:bg-white/10"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="flex-1 max-w-xl mx-0 md:mx-4 hidden md:block">
              <div className="relative group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search leads, outreach, demos..."
                  className="w-full rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/8 dark:border-white/8 py-3 pl-12 pr-4 outline-none focus:border-[var(--accent)]/70 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all shadow-[var(--surface-shadow-soft)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {quickActions.map((action, i) => (
                <Button
                  key={i}
                  variant="icon"
                  className="hidden sm:flex"
                  title={action.label}
                >
                  <action.icon size={18} />
                </Button>
              ))}

              <div className="flex items-center gap-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.02] border border-black/8 dark:border-white/6 px-3 py-2 shadow-[var(--surface-shadow-soft)] transition-colors duration-300">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Admin</p>
                  <p className="text-xs text-[var(--text-secondary)]">Internal User</p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-orange-300 flex items-center justify-center text-white font-bold shadow-[0_12px_24px_rgba(255,122,0,0.22)]">
                  A
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
