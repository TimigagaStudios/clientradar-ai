import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Trash2, Shield, LogOut, Monitor } from 'lucide-react';
import Button from '../components/Button';
import { useLeads } from '../context/LeadContext';
import { supabase } from '../lib/supabase';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { resetData } = useLeads();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-[var(--text-secondary)]">
          Manage your account and app preferences
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance */}
        <section className="neo-card p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Monitor size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Appearance
            </h2>
          </div>

          <div className="space-y-4">
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
                  <p className="font-medium text-[var(--text-primary)]">
                    Theme Mode
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Currently {theme} mode
                  </p>
                </div>
              </div>

              <Button
                onClick={toggleTheme}
                variant="secondary"
                size="sm"
                className="px-4 py-2 text-xs md:text-sm font-semibold"
              >
                {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
              </Button>
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="neo-card p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Shield size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Account & Security
            </h2>
          </div>

          <div className="space-y-4">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
              onClick={handleLogout}
            >
              <LogOut size={18} />
              Logout from account
            </Button>
          </div>
        </section>

        {/* Data */}
        <section className="neo-card p-8 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Data Management
            </h2>
          </div>

          <div className="p-6 neo-in rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Reset All Lead Data
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This action cannot be undone. All leads and activity will be permanently deleted.
              </p>
            </div>

            <Button
              onClick={resetData}
              variant="secondary"
              className="bg-red-500 text-white hover:bg-red-600 px-5 py-2.5"
            >
              Reset Database
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
