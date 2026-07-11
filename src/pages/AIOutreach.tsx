import React, { useMemo, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { Sparkles, Wand2, Mail, MessageSquare, Send } from 'lucide-react';
import { useToast } from '../components/ui/useToast';
import { useNavigate } from 'react-router-dom';

type Channel = 'Auto' | 'Email' | 'SMS' | 'WhatsApp' | 'Instagram';
type OutreachType = 'Intro Email' | 'Follow-up Email' | 'Short DM' | 'AI Follow-up';
type Tone = 'Professional' | 'Friendly' | 'Bold' | 'Premium';
type FocusKey = 'No website' | 'Outdated website' | 'Better branding' | 'Demo offer' | 'More clients';
type CtaKey = 'Reply if interested' | 'Book a call' | 'Review the demo';

const AIOutreach = () => {
  const { leads } = useLeads();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [channel, setChannel] = useState<Channel>('Auto');
  const [outreachType, setOutreachType] = useState<OutreachType>('Intro Email');
  const [tone, setTone] = useState<Tone>('Professional');
  const [focus, setFocus] = useState<FocusKey>('No website');
  const [cta, setCta] = useState<CtaKey>('Reply if interested');

  const selectedLead = useMemo(
    () => leads.find((lead: any) => String(lead.id) === String(selectedLeadId)) || null,
    [leads, selectedLeadId]
  );

  // Available channels for this lead
  const availableChannels = useMemo(() => {
    if (!selectedLead) return { Email: false, SMS: false, WhatsApp: false, Instagram: false };
    const l: any = selectedLead;
    return {
      Email: !!l.email,
      SMS: !!l.phone,
      WhatsApp: !!l.phone,
      Instagram: !!l.instagram,
    };
  }, [selectedLead]);

  const effectiveChannel: Exclude<Channel, 'Auto'> = useMemo(() => {
    if (channel !== 'Auto') return channel as Exclude<Channel, 'Auto'>;
    if (availableChannels.Email) return 'Email';
    if (availableChannels.WhatsApp) return 'WhatsApp';
    if (availableChannels.SMS) return 'SMS';
    if (availableChannels.Instagram) return 'Instagram';
    return 'Email';
  }, [channel, availableChannels]);

  const generated = useMemo(() => {
    if (!selectedLead) {
      return { subject: '', body: '', short: '', chars: 0 };
    }
    const l: any = selectedLead;
    const business = l.businessName || 'your business';
    const demo = l.demoLink || '';
    const hasDemo = !!l.demoLink;
    const hasWebsite = !!l.website;

    const isFollowUp = outreachType === 'Follow-up Email' || outreachType === 'AI Follow-up';
    const isDM = effectiveChannel === 'Instagram' || outreachType === 'Short DM';

    // Email-style openings
    const toneOpeningsEmail: Record<Tone, string> = {
      Professional: isFollowUp
        ? `Hi, I wanted to follow up regarding ${business}.`
        : `Hi, I came across ${business} and wanted to reach out.`,
      Friendly: isFollowUp
        ? `Hi again, just checking in on my earlier message about ${business}.`
        : `Hi there, I found ${business} and thought I should say hello.`,
      Bold: isFollowUp
        ? `Hi, I didn't want this opportunity for ${business} to get missed.`
        : `Hi, I noticed an opportunity for ${business} that could make a strong difference.`,
      Premium: isFollowUp
        ? `Hello, I wanted to revisit the opportunity I mentioned for ${business}.`
        : `Hello, I was reviewing ${business} and saw a clear opportunity to elevate its digital presentation.`,
    };

    // SMS/DM short openings
    const toneOpeningsShort: Record<Tone, string> = {
      Professional: `Hi ${business}, quick note from Timigaga Studios.`,
      Friendly: `Hey ${business}! Quick one from Timigaga.`,
      Bold: `${business} - fast digital win here.`,
      Premium: `Hello ${business}, Timigaga Studios here with a quick opportunity.`,
    };

    const focusLines: Record<FocusKey, string> = {
      'No website': `${business} appears to have limited online visibility, which may be costing valuable opportunities.`,
      'Outdated website': `Your current website presence could be modernized to better reflect the quality of your business.`,
      'Better branding': `There's room to strengthen how ${business} is presented visually and strategically online.`,
      'Demo offer': hasDemo
        ? `I prepared a concept direction that shows how ${business} could look with a stronger digital experience.`
        : `A quick demo concept could help show the digital potential for ${business}.`,
      'More clients': `A stronger online experience can help ${business} attract more qualified customers and build trust faster.`,
    };

    const focusShort: Record<FocusKey, string> = {
      'No website': `no strong website yet - missing easy clients`,
      'Outdated website': `site could use a modern refresh`,
      'Better branding': `brand presentation could convert better online`,
      'Demo offer': hasDemo ? `made a quick demo concept for you` : `can mock up a fast demo`,
      'More clients': `stronger site = more qualified clients`,
    };

    const ctaLines: Record<CtaKey, string> = {
      'Book a call': `If you're open to it, I'd be happy to schedule a quick call and show you the opportunity.`,
      'Review the demo': hasDemo
        ? `You can take a look at the concept here: ${demo}`
        : `If helpful, I can also put together a short demo concept to illustrate the direction.`,
      'Reply if interested': `If this is something you'd like to explore, just reply and I'll share the next step.`,
    };

    const ctaShort: Record<CtaKey, string> = {
      'Book a call': `Open to a 10-min call?`,
      'Review the demo': hasDemo ? `Demo here: ${demo}` : `Want a quick demo mockup?`,
      'Reply if interested': `Reply YES if interested`,
    };

    // --- Email (full) ---
    if (effectiveChannel === 'Email') {
      let subject = '';
      let body = '';
      let short = '';

      const opening = toneOpeningsEmail[tone];
      const focusTxt = focusLines[focus];
      const ctaTxt = ctaLines[cta];

      if (outreachType === 'Intro Email') {
        subject = `Quick idea for ${business}`;
        body = `${opening}

${focusTxt}

I work on premium websites, digital experiences, and brand presentation for businesses that want to improve visibility and conversion.

${ctaTxt}

Best,
Timigaga Studios`;
        short = `Hi ${business}, I noticed a digital opportunity for your business. ${focusTxt} ${ctaTxt}`;
      } else if (outreachType === 'Follow-up Email' || outreachType === 'AI Follow-up') {
        subject = `Following up on ${business}`;
        body = `${opening}

I wanted to check if you had a chance to see my earlier note.

${focusTxt}

${ctaTxt}

Best,
Timigaga Studios`;
        short = `Hi ${business}, just following up on my earlier message. ${ctaTxt}`;
      } else {
        // Short DM, but via Email channel – keep it short
        subject = `${business} quick idea`;
        body = `${toneOpeningsEmail[tone]}

${focusTxt}

${ctaTxt}

- Timigaga Studios`;
        short = `Hi ${business}, I noticed an opportunity around your online presence. ${ctaTxt}`;
      }

      return { subject, body, short, chars: body.length };
    }

    // --- SMS / WhatsApp ---
    if (effectiveChannel === 'SMS' || effectiveChannel === 'WhatsApp') {
      const opening = toneOpeningsShort[tone];
      const f = focusShort[focus];
      const c = ctaShort[cta];
      const isWA = effectiveChannel === 'WhatsApp';

      let body = `${opening} ${f}. ${c}`;
      if (isWA && hasDemo) {
        body += ` Demo: ${demo}`;
      }
      body += `\n\n- Timigaga Studios`;
      if (effectiveChannel === 'SMS') {
        body += `\nReply STOP to opt out`;
      }

      // keep under ~300 chars for SMS, trim if needed
      if (effectiveChannel === 'SMS' && body.length > 320) {
        body = `${opening} ${f}. ${c} - Timigaga\nReply STOP to opt out`;
      }

      return {
        subject: '',
        body,
        short: body,
        chars: body.length,
      };
    }

    // --- Instagram DM ---
    // Instagram
    const igOpening = tone === 'Friendly' || tone === 'Bold'
      ? `Hey ${business}! 👋 Found you on Instagram`
      : `Hi ${business}, came across your page`;
    const igFocus = {
      'No website': `noticed you don't have a proper site linked – you're leaving bookings on the table`,
      'Outdated website': `your site could use a glow-up to match your brand here`,
      'Better branding': `your IG looks great – your website could match that energy`,
      'Demo offer': hasDemo ? `I mocked up a quick site concept for ${business} – want the link?` : `want me to mock up a quick site concept?`,
      'More clients': `a sharper site would turn these IG views into actual clients`,
    }[focus];

    const igCta = {
      'Book a call': `open to a quick chat?`,
      'Review the demo': hasDemo ? `demo: ${demo}` : `want me to send a demo?`,
      'Reply if interested': `DM me YES if you want to see it`,
    }[cta];

    const igBody = `${igOpening}. ${igFocus}. ${igCta} – Timigaga Studios`;
    return {
      subject: '',
      body: igBody,
      short: igBody,
      chars: igBody.length,
    };
  }, [selectedLead, outreachType, tone, focus, cta, effectiveChannel]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        type: 'success',
        title: `${label} copied`,
        message: `${label} has been copied to your clipboard.`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Copy failed',
        message: `Could not copy ${label.toLowerCase()}.`,
      });
    }
  };

  const handleUseInOutreach = () => {
    if (!selectedLead) return;
    localStorage.setItem(
      'clientradar-outreach-draft',
      JSON.stringify({
        leadId: (selectedLead as any).id,
        subject: generated.subject,
        body: generated.body,
        type: outreachType,
        channel: effectiveChannel,
      })
    );
    showToast({
      type: 'success',
      title: 'Draft moved to Outreach',
      message: `Your ${effectiveChannel} message is ready in the Outreach workspace.`,
    });
    navigate('/outreach');
  };

  const channelOptions: { value: Channel; label: string; available: boolean }[] = [
    { value: 'Auto', label: 'Auto - best available', available: true },
    { value: 'Email', label: `Email${selectedLead ? (availableChannels.Email ? '' : ' - no email') : ''}`, available: !selectedLead || availableChannels.Email },
    { value: 'SMS', label: `SMS${selectedLead ? (availableChannels.SMS ? '' : ' - no phone') : ''}`, available: !selectedLead || availableChannels.SMS },
    { value: 'WhatsApp', label: `WhatsApp${selectedLead ? (availableChannels.WhatsApp ? '' : ' - no phone') : ''}`, available: !selectedLead || availableChannels.WhatsApp },
    { value: 'Instagram', label: `Instagram DM${selectedLead ? (availableChannels.Instagram ? '' : ' - no IG') : ''}`, available: !selectedLead || availableChannels.Instagram },
  ];

  const inputCls = "w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] outline-none bg-transparent";
  const isEmailChannel = effectiveChannel === 'Email';
  const charLimit = effectiveChannel === 'SMS' ? 320 : effectiveChannel === 'Instagram' ? 500 : 2000;
  const charColor = generated.chars > charLimit ? 'text-red-400' : generated.chars > charLimit * 0.85 ? 'text-yellow-500' : 'text-[var(--text-secondary)]';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            AI Outreach Generator
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Generate smarter outreach and follow-up messages based on your lead data, tone, and positioning.
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
        <section className="neo-card p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Generator Controls
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Select a lead and customize the message direction.
            </p>
          </div>

          <div className="space-y-4">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select a lead</option>
              {leads.map((lead: any) => (
                <option key={lead.id} value={lead.id} className="bg-[#0A0A0A] text-white">
                  {lead.businessName}
                </option>
              ))}
            </select>

            {/* Channel selector – NEW */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold ml-1 mb-1 block">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className={inputCls}
              >
                {channelOptions.map((c) => (
                  <option key={c.value} value={c.value} disabled={!c.available} className="bg-[#0A0A0A] text-white">
                    {c.label}
                  </option>
                ))}
              </select>
              {selectedLead && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 ml-1">
                  Available: {[
                    availableChannels.Email && 'Email',
                    availableChannels.SMS && 'SMS',
                    availableChannels.WhatsApp && 'WhatsApp',
                    availableChannels.Instagram && 'Instagram'
                  ].filter(Boolean).join(' • ') || 'No contact info – add phone/email in Lead Detail'}
                  {channel === 'Auto' && ` – using ${effectiveChannel}`}
                </p>
              )}
            </div>

            <select
              value={outreachType}
              onChange={(e) => setOutreachType(e.target.value as OutreachType)}
              className={inputCls}
            >
              {['Intro Email', 'Follow-up Email', 'Short DM', 'AI Follow-up'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className={inputCls}
            >
              {['Professional', 'Friendly', 'Bold', 'Premium'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as FocusKey)}
              className={inputCls}
            >
              {['No website', 'Outdated website', 'Better branding', 'Demo offer', 'More clients'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>

            <select
              value={cta}
              onChange={(e) => setCta(e.target.value as CtaKey)}
              className={inputCls}
            >
              {['Reply if interested', 'Book a call', 'Review the demo'].map((item) => (
                <option key={item} value={item} className="bg-[#0A0A0A] text-white">
                  {item}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="neo-card p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Generated Outreach
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Copy this content or push it into the Outreach workspace.
              {!isEmailChannel && (
                <span className="ml-2 text-[var(--accent)] font-semibold">{effectiveChannel}</span>
              )}
            </p>
          </div>

          {!selectedLead ? (
            <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
              Select a lead to generate outreach content.
            </div>
          ) : (
            <>
              {isEmailChannel && (
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
                    {generated.subject || '-'}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-secondary)]">
                    {isEmailChannel ? 'Email Body' : effectiveChannel + ' Message'}
                  </label>
                  <div className="flex items-center gap-3">
                    {!isEmailChannel && (
                      <span className={`text-xs font-mono ${charColor}`}>
                        {generated.chars}/{charLimit}
                      </span>
                    )}
                    <button
                      onClick={() => copyText(generated.body, effectiveChannel + ' message')}
                      className="text-[var(--accent)] text-sm font-semibold hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className={`neo-in rounded-2xl p-5 text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-7 ${!isEmailChannel ? '' : 'font-mono'}`}>
                  {generated.body || '-'}
                </div>
              </div>

              {isEmailChannel && (
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
                    {generated.short || '-'}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button className="btn-neumorph px-4 py-2 text-sm gap-2 inline-flex items-center">
                  <Wand2 size={14} />
                  Refine Later
                </button>
                <button
                  onClick={handleUseInOutreach}
                  disabled={!selectedLead}
                  className="btn-neumorph-primary px-4 py-2 text-sm gap-2 inline-flex items-center disabled:opacity-50"
                >
                  {isEmailChannel ? <Mail size={14} /> : <MessageSquare size={14} />}
                  Use in {effectiveChannel}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] opacity-80">
                Rule-based v2.1 – channel-aware. V3 will use LLM + memory.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AIOutreach;
