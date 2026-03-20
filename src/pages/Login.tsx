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
    
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      setIsLoading(false);
      navigate('/');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6 transition-colors duration-500 overflow-hidden relative">
      {/* Decorative Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-5 blur-[120px] rounded-full" />

      <div className="w-full max-w-lg animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--accent)] rounded-[30%] neo-button mb-6">
            <Zap className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">ClientRadar</h1>
          <p className="text-[var(--text-secondary)] font-bold tracking-widest uppercase text-xs">Internal Lead Engine Access</p>
        </div>

        <form onSubmit={handleLogin} className="neo-card p-10 space-y-8 relative overflow-hidden">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">Work Email</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-4 pl-14 pr-4 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all font-medium"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={20} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg)] neo-in rounded-2xl py-4 pl-14 pr-14 outline-none border-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="w-6 h-6 neo-in rounded-lg flex items-center justify-center transition-all group-hover:neo-out">
                <input type="checkbox" className="hidden peer" defaultChecked />
                <div className="w-3 h-3 bg-[var(--accent)] rounded-sm opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm font-bold text-[var(--text-secondary)]">Remember me</span>
            </label>
            <a href="#" className="text-sm font-bold text-[var(--accent)] hover:underline">Forgot password?</a>
          </div>

          <Button 
            type="submit" 
            className="w-full py-5 text-lg font-black tracking-widest uppercase gap-3 shadow-[0_20px_40px_rgba(255,122,0,0.3)]"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck size={22} />
                Enter Command Center
              </>
            )}
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-40">
              Secured by Enterprise OAuth 2.0
            </p>
          </div>
        </form>

        <p className="text-center mt-8 text-sm font-medium text-[var(--text-secondary)]">
          Don't have an internal account? <a href="#" className="text-[var(--accent)] font-bold hover:underline">Contact System Admin</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
