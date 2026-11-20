import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Trash2, Shield, LogOut, Monitor, Download, Bell, BellRing, Loader2 } from 'lucide-react';
import { disablePush, enablePush, pushState, testPush, type PushState } from '../lib/push';
import Button from '../components/Button';
import { useLeads } from '../context/LeadContext';
import { useToast } from '../components/ui/useToast';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { leads, resetData } = useLeads();
  const { showToast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [push, setPush] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState('');

  useEffect(() => { void pushState().then(setPush).catch(() => undefined); }, []);

  const togglePush = async () => {
    setPushBusy(true);
    setPushNote('');
    try {
      if (push === 'on') {
        await disablePush();
        setPush('off');
        setPushNote('Notifications are off.');
      } else {
        await enablePush();
        setPush('on');
        setPushNote('Notifications are on. Replies, drafts and demos will reach your lock screen.');
      }
    } catch (error) {
      setPushNote(error instanceof Error ? error.message : 'Could not change notifications.');
      setPush(await pushState().catch(() => push));
    }
    setPushBusy(false);
  };

  const sendTest = async () => {
    setPushBusy(true);
    setPushNote('');
    try {
      const out = await testPush();
      setPushNote(out.sent ? 'Test sent. Check your lock screen.' : out.errors.length ? `The push service said: ${out.errors[0]}` : 'No device received it yet. Make sure notifications are on, then try again.');
    } catch (error) {
      setPushNote(error instanceof Error ? error.message : 'Could not send the test.');
    }
    setPushBusy(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleResetData = async () => {
    if (isResetting) return;
    setIsResetting(true);
    setResetError('');
    try {
      const deleted = await resetData();
      setShowResetConfirm(false);
      showToast({
        type: 'success',
        title: 'Lead database reset',
        message: deleted > 0
          ? `Deleted ${deleted} ${deleted === 1 ? 'lead' : 'leads'} along with attached demos, notes, and outreach logs.`
          : 'All lead records are now cleared.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reset lead database.';
      setResetError(message);
      showToast({
        type: 'error',
        title: 'Reset failed',
        message,
      });
    } finally {
      setIsResetting(false);
    }
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
                : 'Android/Chrome: Menu -> Install App | iOS Safari: Share -> Add to Home Screen'}
            </p>
          </div>
        </section>

        {/* Notifications */}
        <section className="neo-card p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Bell size={18} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Notifications</h2>
          </div>

          <div className="neo-in rounded-2xl p-4 space-y-3">
            <p className="font-medium text-[var(--text-primary)]">
              {push === 'on' ? 'Lock-screen notifications are on' : 'Lock-screen notifications'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {push === 'not-installed' && 'ClientRadar must be installed first: Share, then Add to Home Screen, then open it from the icon.'}
              {push === 'denied' && 'Notifications are blocked in the phone settings. Allow them, then come back here.'}
              {push === 'not-configured' && 'The server is not set up for notifications yet (VAPID keys missing in Vercel).'}
              {push === 'bad-keys' && 'The keys in Vercel do not match. Open the key generator page, generate fresh keys, and paste both into Vercel again.'}
              {push === 'unsupported' && 'This browser cannot do push notifications.'}
              {(push === 'off' || push === 'on') && 'New replies, drafts ready for approval and finished demos reach your lock screen, even when the app is closed.'}
            </p>
            {pushNote && <p className="text-sm text-[var(--text-secondary)]" role="status">{pushNote}</p>}
            <div className="flex flex-wrap gap-2">
              {(push === 'off' || push === 'denied' || push === 'not-installed' || push === 'bad-keys') && (
                <button type="button" onClick={() => void togglePush()} disabled={pushBusy} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: '#FF7A00' }}>
                  <BellRing size={15} className="inline -mt-0.5 mr-1.5" />Turn on notifications
                </button>
              )}
              {push === 'on' && (
                <>
                  <button type="button" onClick={() => void sendTest()} disabled={pushBusy} className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: '#FF7A00' }}>Send a test</button>
                  <button type="button" onClick={() => void togglePush()} disabled={pushBusy} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)] disabled:opacity-40">Turn off</button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* About / Brand */}
        <section className="neo-card p-6 md:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Logo size={40} showText={false} />
            <div>
              <p className="font-black text-[var(--text-primary)]">ClientRadar AI</p>
              <p className="text-xs text-[var(--text-secondary)]">V2.5 Revenue Mode | Timigaga Studios</p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-7">
            AI-powered agency operating system - leads, outreach, demos, deals. Revenue first, automation later.
          </p>
        </section>

        {/* Data Management - full width */}
        <section className="neo-card p-6 md:p-8 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 neo-in rounded-xl">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Data Management</h2>
          </div>

          <div className="p-5 md:p-6 neo-in rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Reset All Lead Data ({leads.length} {leads.length === 1 ? 'lead' : 'leads'} saved)
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This action cannot be undone. All leads and their attached demos, notes, and outreach logs will be permanently deleted in one step.
              </p>
            </div>
            <Button
              onClick={() => {
                setResetError('');
                setShowResetConfirm(true);
              }}
              variant="secondary"
              disabled={isResetting}
              className="bg-red-500 text-white hover:bg-red-600 px-5 py-2.5 whitespace-nowrap disabled:opacity-50"
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

            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400">
              All {leads.length} saved {leads.length === 1 ? 'lead' : 'leads'}, notes, outreach logs, demos, and lead deals will be permanently deleted. Linked invoice records block this reset. Deletion is not transactional: if a later step fails, some changes may already have happened.
            </div>

            {resetError && (
              <p className="text-xs font-semibold text-red-400 break-words" role="alert">
                {resetError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => setShowResetConfirm(false)}
                variant="secondary"
                disabled={isResetting}
                className="flex-1 disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleResetData()}
                disabled={isResetting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isResetting ? (
                  <><Loader2 size={16} className="animate-spin" /> Resetting...</>
                ) : (
                  'Yes, Reset Everything'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
