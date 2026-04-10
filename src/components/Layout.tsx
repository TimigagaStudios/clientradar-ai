import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Download,
  Globe,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  MonitorPlay,
  Sparkles,
} from 'lucide-react';
import { cn } from '../utils/cn';
import Button from './Button';
import AddLeadModal from './AddLeadModal';
import ImportLeadsModal from './ImportLeadsModal';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { useLeads } from '../context/LeadContext';
import { exportLeadsToCSV } from '../utils/exportLeads';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const adminMenuRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { leads } = useLeads();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Search, label: 'Lead Finder', path: '/finder' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: MonitorPlay, label: 'Demos', path: '/demos' },
    { icon: Mail, label: 'Outreach', path: '/outreach' },
    { icon: Sparkles, label: 'AI Outreach', path: '/ai-outreach' },
    { icon: CheckSquare, label: 'Deals', path: '/deals' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  const quickActions = [
    { icon: PlusCircle, label: 'Add Lead' },
    { icon: FileDown, label: 'Import' },
    { icon: Download, label: 'Export' },
    { icon: Mail, label: 'Outreach' },
    { icon: Globe, label: 'Demo' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setIsAdminMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickAction = (label: string) => {
    if (label === 'Add Lead') {
      setIsAddLeadOpen(true);
      return;
    }

    if (label === 'Import') {
      setIsImportOpen(true);
      return;
    }

    if (label === 'Export') {
      exportLeadsToCSV(leads);
      return;
    }

    if (label === 'Outreach') {
      navigate('/outreach');
      return;
    }

    if (label === 'Demo') {
      navigate('/demos');
      return;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleGoToSettings = () => {
    setIsAdminMenuOpen(false);
    navigate('/settings');
  };

  const handleToggleTheme = () => {
    toggleTheme();
    setIsAdminMenuOpen(false);
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!globalSearch.trim()) {
      navigate('/leads');
      return;
    }

    navigate(`/leads?q=${encodeURIComponent(globalSearch.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <AddLeadModal open={isAddLeadOpen} onClose={() => setIsAddLeadOpen(false)} />
      <ImportLeadsModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-72 z-50 lg:z-30 transition-transform duration-300 lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          background:
            theme === 'dark'
              ? 'rgba(17, 28, 68, 0.94)'
              : 'rgba(231, 236, 244, 0.96)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          boxShadow:
            theme === 'dark'
              ? '10px 0 32px rgba(3, 8, 22, 0.28)'
              : '10px 0 28px rgba(120, 136, 159, 0.10)',
        }}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 px-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[var(--accent)] shadow-[0_12px_24px_rgba(255,122,0,0.20)]">
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
                      ? 'bg-[var(--accent)] text-white shadow-[0_14px_24px_rgba(255,122,0,0.22)]'
                      : 'text-[var(--text-secondary)] hover:bg-black/[0.025] dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
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
            <div className="rounded-2xl bg-black/[0.025] dark:bg-white/[0.02] border border-black/6 dark:border-white/6 px-4 py-4 shadow-[var(--surface-shadow-soft)] transition-colors duration-300">
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

      {/* Fixed Header */}
      <header
        className="fixed top-4 left-4 right-4 lg:left-[19rem] lg:right-6 z-40 rounded-[2rem] px-5 sm:px-6 lg:px-8 py-4"
        style={{
          background:
            theme === 'dark'
              ? 'rgba(17, 28, 68, 0.58)'
              : 'rgba(231, 236, 244, 0.58)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow:
            theme === 'dark'
              ? '0 14px 34px rgba(3, 8, 22, 0.18)'
              : '0 12px 26px rgba(120, 136, 159, 0.08)',
          border:
            theme === 'dark'
              ? '1px solid rgba(255,255,255,0.05)'
              : '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <button
            className="lg:hidden rounded-xl bg-white/5 border border-white/8 p-2.5 transition-colors hover:bg-white/10"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex-1 max-w-xl mx-0 md:mx-4 hidden md:block">
            <form onSubmit={handleGlobalSearchSubmit} className="relative group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                size={18}
              />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search leads, outreach, demos..."
                className="w-full rounded-2xl bg-black/[0.025] dark:bg-white/5 border border-black/6 dark:border-white/8 py-3 pl-12 pr-4 outline-none focus:border-[var(--accent)]/70 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all shadow-[var(--surface-shadow-soft)] text-[var(--text-primary)]"
              />
            </form>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {quickActions.map((action, i) => (
              <Button
                key={i}
                variant="icon"
                className="hidden sm:flex"
                title={action.label}
                onClick={() => handleQuickAction(action.label)}
              >
                <action.icon size={18} />
              </Button>
            ))}

            <div className="relative" ref={adminMenuRef}>
              <button
                onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.02] border border-black/6 dark:border-white/6 px-3 py-2 shadow-[var(--surface-shadow-soft)] transition-colors duration-300 hover:opacity-95"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Admin</p>
                  <p className="text-xs text-[var(--text-secondary)]">Internal User</p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-orange-300 flex items-center justify-center text-white font-bold shadow-[0_10px_18px_rgba(255,122,0,0.16)]">
                  A
                </div>

                <ChevronDown
                  size={16}
                  className={cn(
                    'text-[var(--text-secondary)] transition-transform hidden sm:block',
                    isAdminMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {isAdminMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 neo-card p-2 z-50">
                  <button
                    onClick={handleGoToSettings}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <SettingsIcon size={17} />
                    <span className="font-medium">Settings</span>
                  </button>

                  <button
                    onClick={handleToggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
                    <span className="font-medium">
                      Switch to {theme === 'light' ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <LogOut size={17} />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="lg:ml-72 min-h-screen pt-32">
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
