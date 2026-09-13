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
  PlusCircle,
  FileDown,
  Download,
  Globe,
  LogOut,
  Moon,
  Sun,
  MonitorPlay,
  Sparkles,
  FileText,
} from 'lucide-react';
import { cn } from '../utils/cn';
import Button from './Button';
import AddLeadModal from './AddLeadModal';
import ImportLeadsModal from './ImportLeadsModal';
import Logo from './Logo';
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const adminMenuRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { leads } = useLeads();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const displayName = 'Timigaga Studios';

  const maskEmail = (email: string | null) => {
    if (!email || !email.includes('@')) return 'contact@timigaga.com';
    const [local, domain] = email.split('@');
    const VISIBLE_START = 2;
    const VISIBLE_END = 1;
    if (local.length <= VISIBLE_START + VISIBLE_END) {
      return local[0] + '***@' + domain;
    }
    const start = local.slice(0, VISIBLE_START);
    const end = local.slice(-VISIBLE_END);
    return `${start}***${end}@${domain}`;
  };

  const maskedEmail = maskEmail(userEmail);
  const avatarUrl = '/avatar-founder.jpg';

  const menuItems = [
    { icon: Sparkles, label: 'Assistant', path: '/' }, // Ã¢Åâ¦ NEW Ã¢â¬â Executive Agent home
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }, // Ã¢Åâ¦ relocated
    { icon: Search, label: 'Lead Finder', path: '/finder' },
    { icon: Globe, label: 'Lead Globe', path: '/globe' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: MonitorPlay, label: 'Demos', path: '/demos' },
    { icon: Mail, label: 'Outreach', path: '/outreach' },
    { icon: Sparkles, label: 'AI Outreach', path: '/ai-outreach' },
    { icon: CheckSquare, label: 'Deals', path: '/deals' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: FileText, label: 'Invoices', path: '/invoices' }, // Ã¢Åâ¦ Invoices
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  const quickActions = [
    { icon: PlusCircle, label: 'Add Lead' },
    { icon: FileDown, label: 'Import' },
    { icon: Download, label: 'Export' },
    { icon: Mail, label: 'Outreach' },
    { icon: Globe, label: 'Demo' },
  ];

  // Close admin menu on outside click / ESC
  useEffect(() => {
    if (!isAdminMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdminMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isAdminMenuOpen]);

  const handleQuickAction = (label: string) => {
    setIsAdminMenuOpen(false);
    if (label === 'Add Lead') return setIsAddLeadOpen(true);
    if (label === 'Import') return setIsImportOpen(true);
    if (label === 'Export') return exportLeadsToCSV(leads);
    if (label === 'Outreach') return navigate('/outreach');
    if (label === 'Demo') return navigate('/demos');
  };

  const handleLogout = async () => {
    setIsAdminMenuOpen(false);
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return navigate('/leads');
    navigate(`/leads?q=${encodeURIComponent(globalSearch.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <AddLeadModal open={isAddLeadOpen} onClose={() => setIsAddLeadOpen(false)} />
      <ImportLeadsModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
        }}
      >
        <div className="flex flex-col h-full p-6">
          <div className="mb-10">
            <Logo size={44} />
          </div>
          <nav className="flex-1 space-y-3">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200',
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                  )}
                >
                  <item.icon size={19} />
                  <span className="font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Header */}
      <header
        className="fixed top-4 left-4 right-4 lg:left-[19rem] lg:right-6 z-40 rounded-[2rem] px-4 sm:px-6 lg:px-8 py-4"
        style={{
          background:
            theme === 'dark'
              ? 'rgba(17, 28, 68, 0.58)'
              : 'rgba(231, 236, 244, 0.58)',
          backdropFilter: 'blur(28px)',
        }}
      >
        <div className="flex items-center gap-3 w-full">
          <button
            className="lg:hidden rounded-xl bg-white/5 border border-white/8 p-2.5"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <form onSubmit={handleGlobalSearchSubmit} className="flex-1 min-w-0 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search leads, outreach, demos..."
              className="w-full rounded-2xl bg-black/[0.025] dark:bg-white/5 border border-black/6 dark:border-white/8 py-3 pl-12 pr-4 outline-none text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
            />
          </form>
          <div className="flex items-center gap-3 shrink-0">
            {/* Desktop quick actions */}
            <div className="hidden md:flex gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="icon"
                  onClick={() => handleQuickAction(action.label)}
                  aria-label={action.label}
                >
                  <action.icon size={18} />
                </Button>
              ))}
            </div>
            {/* Profile / Admin menu */}
            <div className="relative" ref={adminMenuRef}>
              <button
                onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                className="relative rounded-full p-[2px] transition-all hover:scale-105 active:scale-95 shrink-0"
                aria-expanded={isAdminMenuOpen}
                aria-label="Account menu"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,138,43,0.5), rgba(255,138,43,0.15))'
                }}
              >
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover bg-white ring-1 ring-white/15"
                  width={40}
                  height={40}
                />
              </button>
              {isAdminMenuOpen && (
                <div className="absolute right-0 mt-3 w-72 neo-card p-2 z-[60] shadow-2xl max-w-[calc(100vw-2rem)]">
                  {/* Profile header */}
                  <div className="px-3 py-3 mb-2 neo-in rounded-xl">
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-11 h-11 rounded-full object-cover ring-1 ring-[var(--accent)]/20 flex-shrink-0"
                        width={44}
                        height={44}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-[var(--text-primary)] truncate">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {maskedEmail}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Mobile quick actions */}
                  <div className="md:hidden border-b border-black/5 dark:border-white/5 pb-2 mb-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.label)}
                        className="w-full px-4 py-3 text-left rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] flex items-center gap-3"
                      >
                        <action.icon size={16} className="text-[var(--text-secondary)]" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setIsAdminMenuOpen(false); navigate('/settings'); }}
                    className="w-full px-4 py-3 text-left rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] flex items-center gap-3"
                  >
                    <SettingsIcon size={16} className="text-[var(--text-secondary)]" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setIsAdminMenuOpen(false); toggleTheme(); }}
                    className="w-full px-4 py-3 text-left rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] flex items-center gap-3"
                  >
                    {theme === 'dark' ? <Sun size={16} className="text-[var(--text-secondary)]" /> : <Moon size={16} className="text-[var(--text-secondary)]" />}
                    Toggle Theme
                  </button>
                  <div className="my-1 border-t border-black/5 dark:border-white/5" />
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left rounded-xl hover:bg-red-500/10 text-red-500 flex items-center gap-3"
                  >
                    <LogOut size={16} />
                    Logout
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