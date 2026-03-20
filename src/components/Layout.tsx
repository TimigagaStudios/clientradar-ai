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
  X,
  Zap,
  PlusCircle,
  FileDown,
  Globe
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
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 bottom-0 w-72 glass lg:bg-transparent z-50 lg:z-0 border-r border-[var(--light-text-secondary)]/10 transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center neo-button">
              <Zap className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">ClientRadar</span>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group",
                    isActive 
                      ? "bg-[var(--accent)] text-white neo-button" 
                      : "hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-[var(--text-secondary)]/10">
            <div className="p-4 neo-in rounded-2xl bg-[var(--card)]/50">
              <p className="text-sm font-semibold mb-1">Internal Tool</p>
              <p className="text-xs text-[var(--text-secondary)]">Timigaga Lead Engine v2.0</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--text-secondary)]/10 px-6 py-4 flex items-center justify-between">
          <button 
            className="lg:hidden p-2 neo-button"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full bg-[var(--bg)] neo-in rounded-2xl py-2.5 pl-12 pr-4 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {quickActions.map((action, i) => (
              <Button key={i} variant="icon" className="hidden sm:flex" title={action.label}>
                <action.icon size={18} />
              </Button>
            ))}
            <div className="w-px h-8 bg-[var(--text-secondary)]/20 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">Admin</p>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Internal User</p>
              </div>
              <div className="w-10 h-10 rounded-xl neo-button bg-gradient-to-tr from-[var(--accent)] to-orange-300 flex items-center justify-center text-white font-bold">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
