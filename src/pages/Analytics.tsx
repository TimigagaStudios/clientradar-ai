import { useLeads } from '../context/LeadContext';
import {
  TrendingUp,
  Mail,
  Users,
  DollarSign,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#FF7A00', '#FFB067', '#FF9340', '#FFD1A6', '#FDBA74'];

const Analytics = () => {
  const { leads } = useLeads();

  const totalLeads = leads.length;
  const totalRevenue = leads.reduce((acc, lead) => acc + (lead.dealValue || 0), 0);
  const interested = leads.filter(
    (lead) => lead.status === 'Interested' || lead.status === 'Negotiating'
  ).length;
  const closedDeals = leads.filter((lead) => lead.status === 'Deal Closed').length;
  const emailSent = leads.filter(
    (lead) => lead.status === 'Email Sent' || lead.status === 'Pending Reply'
  ).length;

  const statusData = [
    { name: 'New', value: leads.filter((lead) => lead.status === 'New').length },
    { name: 'Email Sent', value: leads.filter((lead) => lead.status === 'Email Sent').length },
    { name: 'Pending Reply', value: leads.filter((lead) => lead.status === 'Pending Reply').length },
    { name: 'Interested', value: leads.filter((lead) => lead.status === 'Interested').length },
    { name: 'Negotiating', value: leads.filter((lead) => lead.status === 'Negotiating').length },
    { name: 'Closed', value: leads.filter((lead) => lead.status === 'Deal Closed').length },
  ].filter((item) => item.value > 0);

  const nicheMap: Record<string, number> = {};
  leads.forEach((lead) => {
    nicheMap[lead.niche] = (nicheMap[lead.niche] || 0) + 1;
  });

  const nicheData = Object.entries(nicheMap).map(([name, value]) => ({
    name,
    value,
  }));

  const weeklyActivity = [
    { name: 'Mon', leads: 4, outreach: 2, conversions: 1 },
    { name: 'Tue', leads: 7, outreach: 4, conversions: 2 },
    { name: 'Wed', leads: 6, outreach: 3, conversions: 1 },
    { name: 'Thu', leads: 10, outreach: 6, conversions: 3 },
    { name: 'Fri', leads: 12, outreach: 7, conversions: 4 },
    { name: 'Sat', leads: 5, outreach: 2, conversions: 1 },
    { name: 'Sun', leads: 8, outreach: 4, conversions: 2 },
  ];

  const metrics = [
    {
      label: 'Total Leads',
      value: totalLeads,
      icon: Users,
      helper: 'All saved prospects',
    },
    {
      label: 'Emails Sent',
      value: emailSent,
      icon: Mail,
      helper: 'Outbound outreach volume',
    },
    {
      label: 'Interested Leads',
      value: interested,
      icon: TrendingUp,
      helper: 'Warm opportunities',
    },
    {
      label: 'Closed Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      helper: 'Tracked deal value',
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics Hub</h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Performance intelligence for lead quality, outreach activity, and conversion trends.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 shadow-[var(--surface-shadow-soft)]">
          <Activity className="text-[var(--accent)]" size={20} />
          <span className="font-bold text-lg">
            {closedDeals} <span className="text-xs font-medium text-[var(--text-secondary)]">Closed Deals</span>
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
              <p className="text-2xl font-black mb-1">{metric.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] font-semibold mb-2">
                {metric.label}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{metric.helper}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Lead & Outreach Trend</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Weekly performance overview
              </p>
            </div>
            <div className="rounded-xl px-3 py-1.5 neo-in text-xs uppercase font-bold">
              Weekly
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyActivity}>
                <defs>
                  <linearGradient id="analyticsLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7A00" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#FF7A00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--text-secondary)" opacity={0.12} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'var(--surface-shadow-soft)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="#FF7A00"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#analyticsLeads)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Conversion Activity</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Outreach-to-conversion movement
              </p>
            </div>
            <div className="rounded-xl px-3 py-1.5 neo-in text-xs uppercase font-bold">
              Conversion
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--text-secondary)" opacity={0.12} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'var(--surface-shadow-soft)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="conversions" fill="#FF7A00" radius={[8, 8, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Lead Status Breakdown</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Pipeline distribution by stage
              </p>
            </div>
            <PieChartIcon className="text-[var(--accent)]" size={20} />
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={4}
                >
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'var(--surface-shadow-soft)',
                    color: 'var(--text-primary)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Top Niches</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Most common business categories in your pipeline
              </p>
            </div>
            <div className="rounded-xl px-3 py-1.5 neo-in text-xs uppercase font-bold">
              Live
            </div>
          </div>

          <div className="space-y-4">
            {nicheData.length === 0 ? (
              <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
                No niche analytics available yet.
              </div>
            ) : (
              nicheData.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-4 rounded-2xl neo-in"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ background: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Business category
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black">{item.value}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                      Leads
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Analytics;