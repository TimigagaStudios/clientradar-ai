import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import Logo from '../components/Logo';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    if (data.session) {
      navigate('/');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 py-8 md:px-6 transition-colors duration-500 overflow-hidden relative">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        {/* Logo / Title */}
        <div className="text-center mb-8 md:mb-10">
          <div className="flex justify-center mb-5 md:mb-6">
            <Logo size={80} showText={false} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            ClientRadar
          </h1>
          <p className="text-[var(--text-secondary)] font-bold tracking-[0.22em] uppercase text-[10px] md:text-xs">
            Internal Lead Engine Access
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleLogin}
          className="neo-card px-6 py-7 md:px-8 md:py-9 space-y-6 md:space-y-7 relative overflow-hidden"
        >
          <div className="space-y-4 md:space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.22em] ml-1">
                Work Email
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                  size={18}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-3.5 md:py-4 pl-12 md:pl-14 pr-4 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/35 transition-all font-medium text-[var(--text-primary)]"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Field - FIXED EYE TOGGLE */}
            <div className="space-y-2">
              <label className="text-[10px] md:text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.22em] ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors"
                  size={18}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-3.5 md:py-4 pl-12 md:pl-14 pr-14 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/35 transition-all font-medium text-[var(--text-primary)]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)] active:text-[var(--accent)] transition-all p-1 rounded-lg hover:bg-white/5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-1 flex justify-center">
            <Button
              type="submit"
              size="sm"
              className="min-w-[200px] md:min-w-[220px] px-5 md:px-6 py-3 text-[11px] md:text-sm font-black tracking-[0.1em] uppercase gap-2 shadow-[0_16px_26px_rgba(255,122,0,0.22)]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 md:w-5 md:h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Enter Command Center
                </>
              )}
            </Button>
          </div>

          <div className="text-center pt-1">
            <p className="text-[10px] md:text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em] opacity-50">
              Secured internal access
            </p>
          </div>
        </form>

        <p className="text-center mt-6 md:mt-8 text-sm font-medium text-[var(--text-secondary)]">
          Need access?{' '}
          <span className="text-[var(--accent)] font-bold">
            Contact the system administrator
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;