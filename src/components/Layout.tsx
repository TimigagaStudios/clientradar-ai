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
    setIsAdminMenuOpen(false);

    if (label === 'Add Lead') return setIsAddLeadOpen(true);
    if (label === 'Import') return setIsImportOpen(true);
    if (label === 'Export') return exportLeadsToCSV(leads);
    if (label === 'Outreach') return navigate('/outreach');
    if (label === 'Demo') return navigate('/demos');
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <AddLeadModal open={isAddLeadOpen} onClose={() => setIsAddLeadOpen(false)} />
      <ImportLeadsModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />

      <header
        className="fixed top-4 left-4 right-4 lg:left-[19rem] lg:right-6 z-40 rounded-[2rem] px-5 sm:px-6 lg:px-8 py-4"
        style={{
          background:
            theme === 'dark'
              ? 'rgba(17, 28, 68, 0.58)'
              : 'rgba(231, 236, 244, 0.58)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
        }}
      >
        <div className="flex items-center justify-between gap-4">

          <button
            className="lg:hidden rounded-xl bg-white/5 border border-white/8 p-2.5"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          {/* Search hidden on mobile */}
          <div className="flex-1 max-w-xl mx-0 md:mx-4 hidden md:block">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                size={18}
              />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search leads, outreach, demos..."
                className="w-full rounded-2xl bg-black/[0.025] dark:bg-white/5 border border-black/6 dark:border-white/8 py-3 pl-12 pr-4 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">

            {/* ✅ Desktop Quick Actions */}
            <div className="hidden md:flex gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="icon"
                  title={action.label}
                  onClick={() => handleQuickAction(action.label)}
                >
                  <action.icon size={18} />
                </Button>
              ))}
            </div>

            {/* ✅ Profile Dropdown */}
            <div className="relative" ref={adminMenuRef}>
              <button
                onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-2xl bg-black/[0.025] dark:bg-white/[0.02] border border-black/6 dark:border-white/6 px-3 py-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-orange-300 flex items-center justify-center text-white font-bold">
                  A
                </div>

                <ChevronDown
                  size={16}
                  className={cn(
                    'hidden md:block text-[var(--text-secondary)] transition-transform',
                    isAdminMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {isAdminMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 neo-card p-2 z-50">

                  {/* ✅ Mobile Quick Actions */}
                  <div className="md:hidden border-b border-black/5 dark:border-white/5 pb-2 mb-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.label)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        <action.icon size={17} />
                        <span className="font-medium">{action.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGoToSettings}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  >
                    <SettingsIcon size={17} />
                    <span className="font-medium">Settings</span>
                  </button>

                  <button
                    onClick={handleToggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  >
                    {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
                    <span className="font-medium">
                      Switch to {theme === 'light' ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-500"
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

      <main className="lg:ml-72 min-h-screen pt-32">
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;