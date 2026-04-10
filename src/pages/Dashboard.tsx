import { useLeads } from '../context/LeadContext';
import {
  Users,
  Globe,
  MonitorOff,
  Mail,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MonitorPlay,
  ExternalLink,
  CheckCircle2,
  Clock3,
  Send,
  Sparkles,
} from 'lucide-react';

const Dashboard = () => {
  const { leads } = useLeads();

  const totalLeads = leads.length;
  const noWebsite = leads.filter((l) => !l.website).length;
  const outdatedWebsite = leads.filter((l) => l.outdatedWebsite).length;
  const demosTracked = leads.filter((l) => l.demoLink || l.demoStatus).length;
  const readyDemos = leads.filter((l) => l.demoStatus === 'Ready').length;
  const sentDemos = leads.filter((l) => l.demoStatus === 'Sent').length;
  const emailsSent = leads.filter(
    (l) => l.status === 'Email Sent' || l.status === 'Pending Reply'
  ).length;
  const dealsClosed = leads.filter((l) => l.status === 'Deal Closed').length;
  const totalRevenue = leads.reduce((acc, lead) => acc + (lead.dealValue || 0), 0);

  const stats = [
    { label: 'Total Leads', value: totalLeads, icon: Users, trend: '+12%', up: true },
    { label: 'No Website', value: noWebsite, icon: MonitorOff, trend: '+4%', up: true },
    { label: 'Outdated Site', value: outdatedWebsite, icon: Globe, trend: '-2%', up: false },
    { label: 'Demos Tracked', value: demosTracked, icon: MonitorPlay, trend: '+8%', up: true },
    { label: 'Emails Sent', value: emailsSent, icon: Mail, trend: '+25%', up: true },
    { label: 'Deals Closed', value: dealsClosed, icon: DollarSign, trend: '+5%', up: true },
  ];

  const demoLeads = leads
    .filter((lead) => lead.demoLink || lead.demoStatus)
    .slice(0, 4);

  const needsOutreach = leads.filter(
    (lead) =>
      lead.status === 'New' &&
      (!lead.outreachHistory || lead.outreachHistory.length === 0)
  );

  const demoReadyToSend = leads.filter(
    (lead) => lead.demoStatus === 'Ready'
  );

  const awaitingReply = leads.filter(
    (lead) => lead.status === 'Pending Reply'
  );

  const warmOpportunities = leads.filter(
    (lead) => lead.status === 'Interested' || lead.status === 'Negotiating'
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Command Center</h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Internal real-time analytics for Lead Engine
          </p>
        </div>

        <div className="flex items-center gap-3 p-3 neo-in rounded-2xl">
          <TrendingUp className="text-[var(--accent)]" size={20} />
          <span className="font-bold text-lg">
            ${totalRevenue.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Revenue
            </span>
          </span>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="neo-card p-6 flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 neo-in rounded-xl group-hover:scale-110 transition-transform">
                <stat.icon size={22} className="text-[var(--accent)]" />
              </div>
              <div className={stat.up ? 'text-green-500' : 'text-red-500'}>
                <div className="flex items-center gap-0.5 text-xs font-bold">
                  {stat.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {stat.trend}
                </div>
              </div>
            </div>
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Follow-up Organizer */}
      <section className="neo-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 neo-in rounded-xl">
            <Sparkles size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              AI Follow-up Organizer
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Free-first intelligence to help you know what deserves attention next.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="neo-in p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-2">
              Needs First Outreach
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {needsOutreach.length}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              New leads with no outreach history yet.
            </p>
          </div>

          <div className="neo-in p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-2">
              Demo Ready to Send
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {demoReadyToSend.length}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Leads that have demos ready but may still need outbound action.
            </p>
          </div>

          <div className="neo-in p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-2">
              Awaiting Reply
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {awaitingReply.length}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Leads currently sitting in reply wait mode.
            </p>
          </div>

          <div className="neo-in p-5 rounded-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-2">
              Warm Opportunities
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {warmOpportunities.length}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Interested or negotiating leads closest to revenue.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Overview */}
      <section className="neo-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              Demo Status Overview
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Track where demo-related opportunities currently stand.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="neo-in p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <MonitorPlay size={18} className="text-[var(--accent)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Demos Tracked
              </span>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {demosTracked}
            </p>
          </div>

          <div className="neo-in p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Ready Demos
              </span>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {readyDemos}
            </p>
          </div>

          <div className="neo-in p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Send size={18} className="text-blue-500" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Sent Demos
              </span>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {sentDemos}
            </p>
          </div>
        </div>
      </section>

      {/* Recent Demo Assets */}
      <section className="neo-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Recent Demo Assets</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Latest leads with attached demo links
            </p>
          </div>
        </div>

        {demoLeads.length === 0 ? (
          <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
            No demos created yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demoLeads.map((lead) => (
              <div key={lead.id} className="neo-in p-5 rounded-2xl">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-bold text-[var(--text-primary)]">
                      {lead.businessName}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {lead.city} • {lead.category}
                    </p>
                  </div>
                  <MonitorPlay size={18} className="text-[var(--accent)]" />
                </div>

                <div className="mb-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
                      lead.demoStatus === 'Ready'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : lead.demoStatus === 'Sent'
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : lead.demoStatus === 'In Progress'
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-400/20'
                    }`}
                  >
                    {lead.demoStatus || 'Not Started'}
                  </span>
                </div>

                {lead.demoLink ? (
                  <a
                    href={lead.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent)] hover:underline break-all inline-flex items-center gap-2"
                  >
                    Open demo
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No demo link saved yet
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
