import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';

const Login = () => {
  const [email, setEmail] = useState('admin@timigaga.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      setIsLoading(false);
      navigate('/');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6 transition-colors duration-500 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-18 h-18 sm:w-20 sm:h-20 bg-[var(--accent)] rounded-[30%] shadow-[0_14px_30px_rgba(255,122,0,0.28)] mb-6">
            <Zap className="text-white" size={36} />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">ClientRadar</h1>
          <p className="text-[var(--text-secondary)] font-bold tracking-widest uppercase text-xs">
            Internal Lead Engine Access
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="neo-card p-8 md:p-10 space-y-7 relative overflow-hidden"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.22em] ml-1">
                Work Email
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                  size={19}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-4 pl-14 pr-4 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/35 transition-all font-medium text-[var(--text-primary)]"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.22em] ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                  size={19}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-4 pl-14 pr-14 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/35 transition-all font-medium text-[var(--text-primary)]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="w-6 h-6 neo-in rounded-lg flex items-center justify-center">
                <input type="checkbox" className="hidden peer" defaultChecked />
                <div className="w-3 h-3 bg-[var(--accent)] rounded-sm opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                Remember me
              </span>
            </label>

            <a
              href="#"
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              size="md"
              className="mx-auto min-w-[250px] px-8 py-4 text-sm md:text-base font-black tracking-[0.12em] uppercase gap-3 shadow-[0_18px_30px_rgba(255,122,0,0.24)]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={20} />
                  Enter Command Center
                </>
              )}
            </Button>
          </div>

          <div className="text-center pt-1">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">
              Secured internal access
            </p>
          </div>
        </form>

        <p className="text-center mt-8 text-sm font-medium text-[var(--text-secondary)]">
          Don&apos;t have an internal account?{' '}
          <a href="#" className="text-[var(--accent)] font-bold hover:underline">
            Contact System Admin
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
