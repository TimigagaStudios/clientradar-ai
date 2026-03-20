import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Trash2, Shield, LogOut, Monitor } from 'lucide-react';
import Button from '../components/Button';
import { useLeads } from '../context/LeadContext';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { resetData } = useLeads();

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/login';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--text-secondary)]">Manage your account and app preferences</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="neo-card p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 neo-in rounded-lg">
              <Monitor size={20} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold">Appearance</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 neo-in rounded-2xl">
              <div className="flex items-center gap-3">
                {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
                <div>
                  <p className="font-medium">Theme Mode</p>
                  <p className="text-sm text-[var(--text-secondary)]">Currently {theme} mode</p>
                </div>
              </div>
              <Button onClick={toggleTheme} variant="secondary" className="px-4 py-2">
                Switch to {theme === 'light' ? 'Dark' : 'Light'}
              </Button>
            </div>
          </div>
        </section>

        <section className="neo-card p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 neo-in rounded-lg">
              <Shield size={20} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold">Account & Security</h2>
          </div>
          
          <div className="space-y-4">
            <Button 
              variant="secondary" 
              className="w-full justify-start gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              Logout from account
            </Button>
          </div>
        </section>

        <section className="neo-card p-8 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 neo-in rounded-lg">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold">Data Management</h2>
          </div>
          
          <div className="p-6 neo-in rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-medium">Reset All Lead Data</p>
              <p className="text-sm text-[var(--text-secondary)]">This action cannot be undone. All leads and activity will be permanently deleted.</p>
            </div>
            <Button 
              onClick={resetData}
              variant="secondary"
              className="bg-red-500 text-white hover:bg-red-600 px-6"
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
