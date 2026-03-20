import { useLeads } from '../context/LeadContext';
import { 
  Users, 
  Globe, 
  MonitorOff, 
  Layout, 
  Mail, 
  MessageSquare, 
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const Dashboard = () => {
  const { leads } = useLeads();

  const totalLeads = leads.length;
  const noWebsite = leads.filter(l => !l.website).length;
  const outdatedWebsite = leads.filter(l => l.outdatedWebsite).length;
  const demosCreated = leads.filter(l => l.status === 'Demo Created').length;
  const emailsSent = leads.filter(l => l.status === 'Email Sent' || l.status === 'Pending Reply').length;
  const replies = leads.filter(l => l.status === 'Interested' || l.status === 'Negotiating').length;
  const dealsClosed = leads.filter(l => l.status === 'Deal Closed').length;
  const totalRevenue = leads.reduce((acc, lead) => acc + (lead.dealValue || 0), 0);

  const stats = [
    { label: 'Total Leads', value: totalLeads, icon: Users, trend: '+12%', up: true },
    { label: 'No Website', value: noWebsite, icon: MonitorOff, trend: '+4%', up: true },
    { label: 'Outdated Site', value: outdatedWebsite, icon: Globe, trend: '-2%', up: false },
    { label: 'Demo Created', value: demosCreated, icon: Layout, trend: '+18%', up: true },
    { label: 'Emails Sent', value: emailsSent, icon: Mail, trend: '+25%', up: true },
    { label: 'Deals Closed', value: dealsClosed, icon: DollarSign, trend: '+5%', up: true },
  ];

  // Mock data for charts
  const chartData = [
    { name: 'Mon', leads: 4, deals: 1 },
    { name: 'Tue', leads: 7, deals: 2 },
    { name: 'Wed', leads: 5, deals: 1 },
    { name: 'Thu', leads: 9, deals: 3 },
    { name: 'Fri', leads: 12, deals: 4 },
    { name: 'Sat', leads: 6, deals: 2 },
    { name: 'Sun', leads: 8, deals: 3 },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Command Center</h1>
          <p className="text-[var(--text-secondary)] font-medium">Internal real-time analytics for Lead Engine</p>
        </div>
        <div className="flex items-center gap-3 p-2 neo-in rounded-2xl bg-[var(--card)]/50">
          <TrendingUp className="text-[var(--accent)]" size={20} />
          <span className="font-bold text-lg">${totalRevenue.toLocaleString()} <span className="text-xs font-medium text-[var(--text-secondary)]">Revenue</span></span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="neo-card p-6 flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 neo-in rounded-xl group-hover:scale-110 transition-transform">
                <stat.icon size={22} className="text-[var(--accent)]" />
              </div>
              <div className={stat.up ? "text-green-500" : "text-red-500"}>
                <div className="flex items-center gap-0.5 text-xs font-bold">
                  {stat.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {stat.trend}
                </div>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Lead Discovery</h3>
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 neo-in rounded-xl uppercase">This Week</div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-orange-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-orange-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--light-text-secondary)" opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: 'var(--shadow-out)',
                    color: 'var(--text)'
                  }} 
                />
                <Area type="monotone" dataKey="leads" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neo-card p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Deal Conversion</h3>
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 neo-in rounded-xl uppercase">Performance</div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--light-text-secondary)" opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: 'var(--shadow-out)',
                    color: 'var(--text)'
                  }} 
                />
                <Bar dataKey="deals" fill="var(--accent)" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Activity Section */}
      <section className="neo-card p-8">
        <h3 className="text-xl font-bold mb-6">Recent Activity</h3>
        <div className="space-y-6">
          {leads.slice(0, 5).map((lead, i) => (
            <div key={i} className="flex items-center gap-4 p-4 neo-in rounded-2xl group hover:neo-out transition-all duration-300">
              <div className="w-12 h-12 rounded-xl neo-button bg-[var(--card)] flex items-center justify-center text-[var(--accent)] font-bold group-hover:scale-110 transition-transform">
                {lead.businessName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold">{lead.businessName}</p>
                <p className="text-sm text-[var(--text-secondary)]">Status updated to <span className="text-[var(--accent)] font-semibold">{lead.status}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">{new Date(lead.updatedAt).toLocaleDateString()}</p>
                <p className="text-xs font-medium opacity-50">Admin Activity</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
