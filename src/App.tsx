import React from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadFinder from './pages/LeadFinder';
import LeadGlobe from './pages/LeadGlobe';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Outreach from './pages/Outreach';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Analytics from './pages/Analytics';
import Deals from './pages/Deals';
import Demos from './pages/Demos';
import DemoPreview from './pages/DemoPreview';
import AIOutreach from './pages/AIOutreach';
import Invoices from './pages/Invoices';
import Assistant from './pages/Assistant'; // âœ… NEW â€” Executive Agent home

import { LeadProvider } from './context/LeadContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './lib/supabase';
import { ToastProvider } from './components/ui/ToastProvider';

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setLoading(false);
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-primary)]">
        <p className="text-[var(--text-secondary)]">Checking session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LeadProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* âœ… (A) Assistant is now the HOME route (post-login greeting) */}
              <Route path="/" element={<RequireAuth><Layout><Assistant /></Layout></RequireAuth>} />

              {/* âœ… Dashboard relocated to /dashboard (fully intact) */}
              <Route path="/dashboard" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />

              {/* âœ… (B) Dedicated assistant route (reachable from nav anytime) */}
              <Route path="/assistant" element={<RequireAuth><Layout><Assistant /></Layout></RequireAuth>} />

              <Route path="/finder" element={<RequireAuth><Layout><LeadFinder /></Layout></RequireAuth>} />
              <Route path="/globe" element={<RequireAuth><Layout><LeadGlobe /></Layout></RequireAuth>} />
              <Route path="/leads" element={<RequireAuth><Layout><Leads /></Layout></RequireAuth>} />
              <Route path="/leads/:id" element={<RequireAuth><Layout><LeadDetail /></Layout></RequireAuth>} />
              <Route path="/outreach" element={<RequireAuth><Layout><Outreach /></Layout></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth><Layout><Analytics /></Layout></RequireAuth>} />
              <Route path="/deals" element={<RequireAuth><Layout><Deals /></Layout></RequireAuth>} />
              <Route path="/demos" element={<RequireAuth><Layout><Demos /></Layout></RequireAuth>} />
              <Route path="/demos/preview/:id" element={<DemoPreview />} />
              <Route path="/ai-outreach" element={<RequireAuth><Layout><AIOutreach /></Layout></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Layout><Settings /></Layout></RequireAuth>} />

              {/* âœ… Invoices route */}
              <Route path="/invoices" element={<RequireAuth><Layout><Invoices /></Layout></RequireAuth>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </LeadProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
