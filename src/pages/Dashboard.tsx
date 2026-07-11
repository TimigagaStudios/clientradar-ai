import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Send,
  Sparkles,
  Clock3,
} from 'lucide-react';
import { cn } from '../utils/cn';

const Dashboard = () => {
  const { leads } = useLeads();
  const navigate = useNavigate();

  const totalLeads = leads.length;
  const noWebsite = leads.filter((l: any) => !l.website).length;
  const outdatedWebsite = leads.filter((l: any) => l.outdatedWebsite).length;
  const demosTracked = leads.filter((l: any) => l.demoLink || l.demoStatus).length;
  const readyDemos = leads.filter((l: any) => l.demoStatus === 'Ready').length;
  const sentDemos = leads.filter((l: any) => l.demoStatus === 'Sent').length;

  const emailsSent = leads.filter(
    (l: any) => l.status === 'Email Sent' || l.status === 'Pending Reply'
  ).length;

  const dealsClosed = leads.filter((l: any) => l.status === 'Deal Closed').length;
  const totalRevenue = leads.reduce((acc: number, lead: any) => acc + (Number(lead.dealValue) || 0), 0);

  const needsOutreach = leads.filter(
    (lead: any) =>
      lead.status === 'New' &&
      (!lead.outreachHistory || lead.outreachHistory.length === 0)
  );

  const demoReadyToSend = leads.filter(
    (lead: any) => lead.demoStatus === 'Ready'
  );

  const awaitingReply = leads.filter(
    (lead: any) => lead.status === 'Pending Reply'
  );

  const warmOpportunities = leads.filter(
    (lead: any) => lead.status === 'Interested' || lead.status === 'Negotiating'
  );

  const stats = [
    { label: 'Total Leads', value: totalLeads, icon: Users, trend: '+12%', up: true, filter: 'All' },
    { label: 'No Website', value: noWebsite, icon: MonitorOff, trend: '+4%', up: true, filter: 'No Website' },
    { label: 'Outdated Site', value: outdatedWebsite, icon: Globe, trend: '-2%', up: false, filter: 'Outdated Website' },
    { label: 'Demos Tracked', value: demosTracked, icon: MonitorPlay, trend: '+8%', up: true, filter: 'Demo Ready' },
    { label: 'Emails Sent', value: emailsSent, icon: Mail, trend: '+25%', up: true, filter: 'Pending Reply' },
    { label: 'Deals Closed', value: dealsClosed, icon: DollarSign, trend: '+5%', up: true, filter: 'Closed Deals' },
  ];

  const demoLeads = useMemo(() =>
    leads.filter((lead: any) => lead.demoLink || lead.demoStatus).slice(0, 4),
    [leads]
  );

  const reminderGroups = [
    {
      title: 'Needs First Outreach',
      count: needsOutreach.length,
      icon: Send,
      color: 'text-orange-500',
      leads: needsOutreach.slice(0, 3),
      helper: 'New leads with no message sent yet.',
    },
    {
      title: 'Demo Ready to Send',
      count: demoReadyToSend.length,
      icon: MonitorPlay,
      color: 'text-green-500',
      leads: demoReadyToSend.slice(0, 3),
      helper: 'Demos are ready but still need outreach.',
    },
    {
      title: 'Awaiting Reply',
      count: awaitingReply.length,
      icon: Clock3,
      color: 'text-yellow-500',
      leads: awaitingReply.slice(0, 3),
      helper: 'Leads that need timely follow-up.',
    },
    {
      title: 'Warm Opportunities',
      count: warmOpportunities.length,
      icon: CheckCircle2,
      color: 'text-blue-500',
      leads: warmOpportunities.slice(0, 3),
      helper: 'Interested or negotiating leads close to value.',
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--text-primary)]">Command Center</h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Internal real-time analytics for Lead Engine
          </p>
        </div>
        <button
          onClick={() => navigate('/deals')}
          className="flex items-center gap-3 px-4 py-3 neo-in rounded-2xl hover:opacity-90 transition-opacity text-left"
        >
          <TrendingUp className="text-[var(--accent)]" size={20} />
          <span className="font-bold text-lg text-[var(--text-primary)]">
            ${totalRevenue.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Revenue
            </span>
          </span>
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {stats.map((stat, i) => (
          <button
            key={i}
            onClick={() => navigate(`/leads?filter=${encodeURIComponent(stat.filter)}`)}
            className="neo-card p-6 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 text-left w-full"
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
              <p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Follow-up Organizer */}
      <section className="neo-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 neo-in rounded-xl">
            <Sparkles size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              Smarter Follow-up Organizer
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Action-focused reminders based on current lead and demo states.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {reminderGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="neo-in p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={18} className={group.color} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {group.title}
                  </span>
                </div>
                <p className="text-2xl font-black text-[var(--text-primary)] mb-2">
                  {group.count}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  {group.helper}
                </p>
                <div className="space-y-2">
                  {group.leads.length > 0 ? (
                    group.leads.map((lead: any) => (
                      <Link
                        key={lead.id}
                        to={`/leads/${lead.id}`}
                        className="block rounded-xl bg-black/[0.03] dark:bg-white/[0.02] border border-black/8 dark:border-white/6 px-3 py-3 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
                      >
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {lead.businessName}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          {lead.city || 'N/A'} - {lead.category || 'Business'}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Nothing urgent here.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Demo Overview */}
      <section className="neo-card p-6 md:p-8">
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
      <section className="neo-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Recent Demo Assets</h3>
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
            {demoLeads.map((lead: any) => (
              <div key={lead.id} className="neo-in p-5 rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                <Link to={`/leads/${lead.id}`} className="block">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--text-primary)] truncate">
                        {lead.businessName}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {lead.city || 'N/A'} - {lead.category || 'Business'}
                      </p>
                    </div>
                    <MonitorPlay size={18} className="text-[var(--accent)] flex-shrink-0" />
                  </div>
                </Link>
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
                    onClick={e => e.stopPropagation()}
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