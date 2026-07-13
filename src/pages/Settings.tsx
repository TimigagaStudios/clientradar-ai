import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Trash2, Shield, LogOut, Monitor, Download } from 'lucide-react';
import Button from '../components/Button';
import { useLeads } from '../context/LeadContext';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { resetData } = useLeads() as any;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleResetData = () => {
    if (resetData) {
      resetData();
    }
    setShowResetConfirm(false);
  };

  const isPWAInstalled = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-secondary)]">Manage your account and app preferences</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance */}
        <section className="neo-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Monitor size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Appearance</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 neo-in rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] flex items-center justify-center">
                {theme === 'light' ? (
                  <Sun size={18} className="text-[var(--accent)]" />
                ) : (
                  <Moon size={18} className="text-[var(--accent)]" />
                )}
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">Theme Mode</p>
                <p className="text-sm text-[var(--text-secondary)]">Currently {theme} mode</p>
              </div>
            </div>
            <Button onClick={toggleTheme} variant="secondary" size="sm" className="px-4 py-2 text-xs md:text-sm font-semibold whitespace-nowrap">
              {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
            </Button>
          </div>
        </section>

        {/* Account */}
        <section className="neo-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Shield size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Account & Security</h2>
          </div>

          <div className="neo-in rounded-2xl p-4 flex items-center gap-3 mb-3">
            <img src="/avatar-founder.jpg" alt="Profile" className="w-12 h-12 rounded-full object-cover ring-1 ring-[var(--accent)]/20" />
            <div>
              <p className="font-bold text-[var(--text-primary)]">Timigaga Studios</p>
              <p className="text-xs text-[var(--text-secondary)]">Founder Account</p>
            </div>
          </div>

          <Button
            variant="secondary"
            className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout from account
          </Button>
        </section>

        {/* PWA Install */}
        <section className="neo-card p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Download size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">App Install</h2>
          </div>

          <div className="neo-in rounded-2xl p-4">
            <p className="font-medium text-[var(--text-primary)]">
              {isPWAInstalled ? 'ClientRadar is installed' : 'Install ClientRadar'}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {isPWAInstalled
                ? 'Running in standalone mode. Nice!'
                : 'Android/Chrome: Menu → Install App • iOS Safari: Share → Add to Home Screen'}
            </p>
          </div>
        </section>

        {/* About / Brand */}
        <section className="neo-card p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Logo size={40} showText={false} />
            <div>
              <p className="font-black text-[var(--text-primary)]">ClientRadar AI</p>
              <p className="text-xs text-[var(--text-secondary)]">V2.5 Revenue Mode • Timigaga Studios</p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-7">
            AI-powered agency operating system – leads, outreach, demos, deals. Revenue first, automation later.
          </p>
        </section>

        {/* Data Management – full width */}
        <section className="neo-card p-6 md:p-8 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Data Management</h2>
          </div>

          <div className="p-5 md:p-6 neo-in rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[var(--text-primary)]">Reset All Lead Data</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This action cannot be undone. All leads and activity will be permanently deleted.
              </p>
            </div>
            <Button
              onClick={() => setShowResetConfirm(true)}
              variant="secondary"
              className="bg-red-500 text-white hover:bg-red-600 px-5 py-2.5 whitespace-nowrap"
            >
              Reset Database
            </Button>
          </div>
        </section>
      </div>

      {/* ==================== CONFIRMATION MODAL ==================== */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="neo-card max-w-md w-full p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">Reset All Data?</h3>
                <p className="text-sm text-[var(--text-secondary)]">This cannot be undone.</p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300">
              All leads, notes, outreach history, demo status, and deals will be permanently deleted.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => setShowResetConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetData}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Reset Everything
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;