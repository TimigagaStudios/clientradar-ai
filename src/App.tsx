import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadFinder from './pages/LeadFinder';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Outreach from './pages/Outreach';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Analytics from './pages/Analytics';
import { LeadProvider } from './context/LeadContext';
import { ThemeProvider } from './context/ThemeContext';

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App = () => {
  return (
    <ThemeProvider>
      <LeadProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/finder"
              element={
                <RequireAuth>
                  <Layout>
                    <LeadFinder />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/leads"
              element={
                <RequireAuth>
                  <Layout>
                    <Leads />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/leads/:id"
              element={
                <RequireAuth>
                  <Layout>
                    <LeadDetail />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/outreach"
              element={
                <RequireAuth>
                  <Layout>
                    <Outreach />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/analytics"
              element={
                <RequireAuth>
                  <Layout>
                    <Analytics />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/deals"
              element={
                <RequireAuth>
                  <Layout>
                    <Leads />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Layout>
                    <Settings />
                  </Layout>
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </LeadProvider>
    </ThemeProvider>
  );
};

export default App;
