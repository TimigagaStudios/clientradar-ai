import React, { useMemo, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { Sparkles, Wand2, Copy, Mail, MessageSquare } from 'lucide-react';
import { useToast } from '../components/ui/useToast';

const AIOutreach = () => {
  const { leads } = useLeads();
  const { showToast } = useToast();

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [outreachType, setOutreachType] = useState('Intro Email');
  const [tone, setTone] = useState('Professional');
  const [focus, setFocus] = useState('No website');
  const [cta, setCta] = useState('Reply if interested');

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);

  const generated = useMemo(() => {
    if (!selectedLead) {
      return {
        subject: '',
        body: '',
        short: '',
      };
    }

    const business = selectedLead.businessName;
    const city = selectedLead.city;
    const category = selectedLead.category;
    const website = selectedLead.website ? 'website' : 'online presence';
    const demo = selectedLead.demoLink || '[demo link]';

    const toneOpenings: Record<string, string> = {
      Professional: `Hi, I came across ${business} and wanted to reach out.`,
      Friendly: `Hi there, I found ${business} and thought I should say hello.`,
      Bold: `Hi, I noticed an opportunity for ${business} that could make a strong difference.`,
      Premium: `Hello, I was reviewing ${business} and saw a clear opportunity to elevate its digital presentation.`,
    };

    const focusLines: Record<string, string> = {
      'No website': `${business} appears to have limited online visibility, which may be costing valuable opportunities.`,
      'Outdated website': `Your current website presence could be modernized to better reflect the quality of your business.`,
      'Better branding': `There’s room to strengthen how ${business} is presented visually and strategically online.`,
      'Demo offer': `I’ve put together a concept direction that shows how ${business} could look with a stronger digital experience.`,
      'More clients': `A stronger online experience can help ${business} attract more qualified customers and build trust faster.`,
    };

    const ctaLines: Record<string, string> = {
      'Book a call': `If you're open to it, I'd be happy to schedule a quick call and show you the opportunity.`,
      'Review the demo': `You can take a look at the concept here: ${demo}`,
      'Reply if interested': `If this is something you’d like to explore, just reply and I’ll share the next step.`,
    };

    const subject =
      outreachType === 'Follow-up Email'
        ? `Following up on ${business}`
        : outreachType === 'Short DM'
        ? `${business} quick idea`
        : `Quick idea for ${business}`;

    const body = `${toneOpenings[tone]}

${focusLines[focus]}

I work on premium websites, digital experiences, and brand presentation for businesses that want to improve visibility and conversion.

${ctaLines[cta]}

Best,
Timigaga Studios`;

    const short = `Hi ${business}, I noticed a digital opportunity around your ${website}. ${focusLines[focus]} ${ctaLines[cta]}`;

    return {
      subject,
      body,
      short,
    };
  }, [selectedLead, outreachType, tone, focus, cta]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        type: 'success',
        title: `${label} copied`,
        message: `${label} has been copied to your clipboard.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Copy failed',
        message: `Could not copy ${label.toLowerCase()}.`,
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            AI Outreach Generator
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Generate smarter outreach messages based on your lead data, tone, and offer angle.
          </p>
        </div>

        <div className="neo-card px-5 py-4 inline-flex items-center gap-3">
          <Sparkles className="text-[var(--accent)]" size={20} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold">
              Phase 2
            </p>
            <p className="text-lg font-black text-[var(--text-primary)]">
              AI Productivity
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        {/* Controls */}
        <section className="neo-card p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Generator Controls
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Select a lead and customize the messaging direction.
            </p>
          </div>

          <div className="space-y-4">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none"
            >
              <option className="bg-[#0A0A0A] text-white" value="">
                Select a lead
              </option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id} className="bg-[#0A0A0A] text-white">
                  {lead.businessName}
                </option>
              ))}
            </select>

            <select
              value={outreachType}
              onChange={(e) => setOutreachType(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none"
            >
              {['Intro Email', 'Follow-up Email', 'Short DM'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none"
            >
              {['Professional', 'Friendly', 'Bold', 'Premium'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none"
            >
              {['No website', 'Outdated website', 'Better branding', 'Demo offer', 'More clients'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none"
            >
              {['Reply if interested', 'Book a call', 'Review the demo'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Output */}
        <section className="neo-card p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Generated Outreach
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Copy and use this in your outreach workflow.
            </p>
          </div>

          {!selectedLead ? (
            <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
              Select a lead to generate outreach content.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]">
                    Subject
                  </label>
                  <button
                    onClick={() => copyText(generated.subject, 'Subject')}
                    className="text-[var(--accent)] text-sm font-semibold hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="neo-in rounded-2xl p-4 text-[var(--text-primary)] text-sm font-medium">
                  {generated.subject}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]">
                    Email Body
                  </label>
                  <button
                    onClick={() => copyText(generated.body, 'Email body')}
                    className="text-[var(--accent)] text-sm font-semibold hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="neo-in rounded-2xl p-5 text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-7 font-mono">
                  {generated.body}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]">
                    Short Version
                  </label>
                  <button
                    onClick={() => copyText(generated.short, 'Short version')}
                    className="text-[var(--accent)] text-sm font-semibold hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="neo-in rounded-2xl p-4 text-[var(--text-primary)] text-sm leading-7">
                  {generated.short}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button className="btn-neumorph px-4 py-2 text-sm gap-2">
                  <Wand2 size={14} />
                  Refine Later
                </button>
                <button className="btn-neumorph-primary px-4 py-2 text-sm gap-2">
                  <Mail size={14} />
                  Use in Outreach
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AIOutreach;
