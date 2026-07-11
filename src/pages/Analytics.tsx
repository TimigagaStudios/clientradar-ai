import React, { useMemo } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  TrendingUp,
  Mail,
  Users,
  DollarSign,
  Activity,
  MonitorOff,
  Globe,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#FF7A00', '#FFB067', '#FF9340', '#FFD1A6', '#FDBA74', '#F59E0B'];

const Analytics = () => {
  const { leads } = useLeads() as any;

  const totalLeads = leads.length;
  const totalRevenue = leads.reduce((acc: number, lead: any) => acc + (Number(lead.dealValue) || 0), 0);
  const noWebsite = leads.filter((lead: any) => !lead.website).length;
  const outdatedWebsite = leads.filter((lead: any) => lead.outdatedWebsite).length;
  const emailSent = leads.filter((lead: any) => lead.status === 'Email Sent' || lead.status === 'Pending Reply').length;
  const interested = leads.filter((lead: any) => lead.status === 'Interested' || lead.status === 'Negotiating').length;
  const closedDeals = leads.filter((lead: any) => lead.status === 'Deal Closed').length;

  const metrics = [
    { label: 'Total Leads', value: totalLeads, icon: Users, helper: 'All saved prospects' },
    { label: 'No Website', value: noWebsite, icon: MonitorOff, helper: 'High opportunity leads' },
    { label: 'Outdated Website', value: outdatedWebsite, icon: Globe, helper: 'Redesign opportunities' },
    { label: 'Closed Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, helper: 'Tracked deal value' },
  ];

  const statusData = useMemo(() => {
    const raw = [
      { name: 'New', value: leads.filter((l: any) => l.status === 'New').length },
      { name: 'Demo Created', value: leads.filter((l: any) => l.status === 'Demo Created').length },
      { name: 'Email Sent', value: leads.filter((l: any) => l.status === 'Email Sent').length },
      { name: 'Pending Reply', value: leads.filter((l: any) => l.status === 'Pending Reply').length },
      { name: 'Interested', value: leads.filter((l: any) => l.status === 'Interested').length },
      { name: 'Negotiating', value: leads.filter((l: any) => l.status === 'Negotiating').length },
      { name: 'Deal Closed', value: leads.filter((l: any) => l.status === 'Deal Closed').length },
    ];
    return raw.filter((item) => item.value > 0);
  }, [leads]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead: any) => {
      const cat = lead.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead: any) => {
      const p = lead.priority || 'Medium';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const interestedRate = totalLeads > 0 ? ((interested / totalLeads) * 100).toFixed(1) : '0.0';

  const chartCard = 'neo-card p-6 md:p-8';
  const emptyCard = 'neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm';

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--text-primary)]">Analytics Hub</h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Performance intelligence for lead quality, outreach activity, and conversion trends.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl neo-in px-4 py-3">
          <Activity className="text-[var(--accent)]" size={20} />
          <span className="font-bold text-lg text-[var(--text-primary)]">
            {interestedRate}%{' '}
            <span className="text-xs font-medium text-[var(--text-secondary)]">Interest Rate</span>
          </span>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {metrics.map((metric, i) => (
          <div key={i} className="neo-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="p-3 rounded-2xl neo-in">
                <metric.icon size={22} className="text-[var(--accent)]" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black mb-1 text-[var(--text-primary)]">{metric.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] font-semibold mb-2">
                {metric.label}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{metric.helper}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className={chartCard}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Lead Status Breakdown</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Distribution by current pipeline stage</p>
            </div>
          </div>
          {statusData.length === 0 ? (
            <div className={emptyCard}>Not enough status data yet.</div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={4}>
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className={chartCard}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Lead Category Demand</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Which niches appear most often in your system</p>
            </div>
            <TrendingUp className="text-[var(--accent)]" size={20} />
          </div>
          {categoryData.length === 0 ? (
            <div className={emptyCard}>Not enough category data yet.</div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--text-secondary)" opacity={0.12} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="value" fill="#FF7A00" radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Lower insights */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className={chartCard}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Priority Distribution</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">How your current lead urgency is spread</p>
            </div>
            <Mail className="text-[var(--accent)]" size={20} />
          </div>
          {priorityData.length === 0 ? (
            <div className={emptyCard}>No priority data available yet.</div>
          ) : (
            <div className="space-y-4">
              {priorityData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl neo-in">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: COLORS[index % COLORS.length] }}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{item.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">Lead priority</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[var(--text-primary)]">{item.value}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Leads</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={chartCard}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Insight Summary</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Current operating signals from your data</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="neo-in p-5 rounded-2xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-secondary)] mb-2">Highest Demand Category</p>
              <p className="text-[var(--text-primary)] text-xl font-semibold">{categoryData[0]?.name || 'N/A'}</p>
            </div>
            <div className="neo-in p-5 rounded-2xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-secondary)] mb-2">Interest Rate</p>
              <p className="text-[var(--text-primary)] text-xl font-semibold">{interestedRate}%</p>
            </div>
            <div className="neo-in p-5 rounded-2xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-secondary)] mb-2">Revenue Readiness</p>
              <p className="text-[var(--text-secondary)] leading-7 text-sm">
                {closedDeals > 0
                  ? 'The system is already tracking real commercial outcomes. You can expand toward deeper pipeline reporting next.'
                  : 'You are collecting structured lead data, but closed revenue still needs more pipeline maturity.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Analytics;