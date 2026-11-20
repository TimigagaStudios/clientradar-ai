import { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import { FileText, Plus, Download, Trash2, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';
import { amountLabel, invoiceAmount, invoiceDate, invoiceRecordHtml } from '../lib/invoice-safety';
import ListPager, { usePagedList } from '../components/ui/ListPager';
import EventTime from '../components/ui/EventTime';

type Invoice = {
  id: string;
  lead_id: string | null;
  business_name: string;
  amount: number | string;
  status: 'Pending' | 'Paid';
  due_date: string | null;
  created_at: string;
  notes?: string | null;
};

const Invoices = () => {
  const { leads } = useLeads() as any;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const invoicePager = usePagedList(invoices, 'invoices', 10);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error: readError } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (readError || !data) throw new Error('Could not load invoice records. Check your connection and permissions, then retry.');
      setInvoices(data as Invoice[]);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load invoice records.');
      return false;
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchInvoices(); }, []);
  const dealLeads = leads.filter((lead: any) => ['Interested', 'Negotiating', 'Deal Closed'].includes(lead.status));
  const begin = () => { setError(''); setNotice(''); };

  const handleCreateInvoice = async () => {
    if (busy) return;
    begin();
    const lead = dealLeads.find((item: any) => item.id === selectedLeadId);
    const parsed = invoiceAmount(amount);
    if (!lead || parsed === null || !invoiceDate(dueDate)) { setError('Choose a deal, a positive amount with at most two decimal places, and a valid due date.'); return; }
    if (!window.confirm('Create this internal invoice record? The amount and due date are your entries. No invoice or email will be sent.')) return;
    setBusy(true);
    try {
      const { error: writeError } = await supabase.from('invoices').insert({ lead_id: selectedLeadId, business_name: lead.businessName, amount: parsed, status: 'Pending', due_date: dueDate, notes: notes.trim() || null });
      if (writeError) throw new Error('Save was not confirmed. Reload the list and check whether the record exists before trying again.');
      setShowCreateForm(false); setSelectedLeadId(''); setAmount(''); setDueDate(''); setNotes('');
      setNotice('Record created. No invoice or email was sent.');
      if (!(await fetchInvoices())) setNotice('Record created, but the list could not refresh. Reload before trying again.');
    } catch { setError('Save was not confirmed. Reload the list and check whether the record exists before trying again.'); }
    finally { setBusy(false); }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    if (busy || !window.confirm('Manually mark this record as paid? Confirm the payment independently first. This does not check your bank or payment provider.')) return;
    begin(); setBusy(true);
    try {
      const { data, error: writeError } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', invoice.id).eq('status', 'Pending').select('id');
      if (writeError) throw new Error('Could not update the record. Check your connection and permissions.');
      if (!Array.isArray(data) || data.length !== 1) throw new Error('Record was not updated. It may have changed or your account may not have permission. Reload and check.');
      setSelectedInvoice({ ...invoice, status: 'Paid' }); setNotice('Marked paid manually. This is not independent proof of payment.');
      if (!(await fetchInvoices())) setNotice('Record updated, but the list could not refresh. Reload before making more changes.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the record.'); }
    finally { setBusy(false); }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (busy || !window.confirm('Permanently delete this invoice record? This cannot be undone.')) return;
    begin(); setBusy(true);
    try {
      const { data, error: writeError } = await supabase.from('invoices').delete().eq('id', id).select('id');
      if (writeError) throw new Error('Could not delete the record. Check your connection and permissions.');
      if (!Array.isArray(data) || data.length !== 1) throw new Error('Record was not deleted. It may have changed or your account may not have permission. Reload and check.');
      setSelectedInvoice(null); setNotice('Invoice record deleted.');
      if (!(await fetchInvoices())) setNotice('Record deleted, but the list could not refresh. Reload before making more changes.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete the record.'); }
    finally { setBusy(false); }
  };

  const printRecord = (invoice: Invoice) => {
    begin();
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Could not open the print window. Allow pop-ups and try again.'); return; }
    printWindow.document.open(); printWindow.document.write(invoiceRecordHtml(invoice)); printWindow.document.close();
    window.setTimeout(() => { try { printWindow.focus(); printWindow.print(); } catch { setError('Could not open the print dialog.'); } }, 300);
  };

  return <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 md:px-0">
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Invoices</h1><p className="text-[var(--text-secondary)] font-medium">Internal invoice records for deals. No invoice is sent or payment verified here.</p></div>
      <button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium w-full md:w-auto justify-center"><Plus size={18} /> Create record</button>
    </header>
    <p className="text-sm text-[var(--text-secondary)]">This screen does not record or verify a currency. Confirm currency, services, taxes and terms separately before issuing an invoice.</p>
    {error && <div role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{error} <button type="button" onClick={() => { setError(''); void fetchInvoices(); }} className="underline font-bold">Reload list</button></div>}
    {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
    {showCreateForm && <section className="neo-card p-4 sm:p-6 md:p-8 space-y-4">
      <h2 className="text-xl font-bold">Create invoice record</h2>
      <label className="block text-sm font-bold">Deal<select value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)} className="mt-1 w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"><option value="">Select a deal...</option>{dealLeads.slice(0, 250).map((lead: any) => <option key={lead.id} value={lead.id}>{lead.businessName} - saved deal amount: {lead.dealValue == null ? 'not set' : amountLabel(lead.dealValue)}</option>)}</select></label>
      {dealLeads.length > 250 && <p className="text-xs text-[var(--text-secondary)]">Showing the first 250 eligible leads.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-sm font-bold">Amount (currency not verified)<input type="number" min="0.01" max="999999999.99" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]" /></label>
        <label className="block text-sm font-bold">Due date<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full min-w-0 rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]" /></label>
      </div>
      <label className="block text-sm font-bold">Internal notes (optional)<input type="text" maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]" /></label>
      <div className="flex flex-wrap gap-3"><button onClick={() => void handleCreateInvoice()} disabled={busy || !selectedLeadId || invoiceAmount(amount) === null || !invoiceDate(dueDate)} className="px-6 py-3 bg-[var(--accent)] text-white rounded-2xl disabled:opacity-50">{busy ? 'Saving...' : 'Create record'}</button><button disabled={busy} onClick={() => setShowCreateForm(false)} className="px-6 py-3 neo-button rounded-2xl">Cancel</button></div>
    </section>}
    <section className="neo-card p-4 sm:p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6"><FileText size={20} className="text-[var(--accent)]" /><h2 className="text-xl font-bold">Invoice records</h2></div>
      {loading ? <p className="text-center py-12 text-[var(--text-secondary)]">Loading invoice records...</p> : invoices.length === 0 ? <p className="text-center py-12 text-[var(--text-secondary)]">No invoice records loaded.</p> : <div className="space-y-3">
        {invoicePager.visible.map(invoice => <button type="button" key={invoice.id} onClick={() => setSelectedInvoice(invoice)} className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl neo-in text-left">
          <span className="min-w-0"><span className="block font-semibold text-[var(--text-primary)] break-words">{invoice.business_name || 'Business not recorded'}</span><span className="block text-xs text-[var(--text-secondary)]">Created date: {invoiceDate(invoice.created_at?.slice(0, 10)) ? invoice.created_at.slice(0, 10) : 'Not recorded'}</span></span>
          <span className="shrink-0 text-right"><span className="block font-bold text-[var(--text-primary)]">{amountLabel(invoice.amount)}</span><span className={cn('text-xs px-2 py-0.5 rounded-full', invoice.status === 'Paid' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500')}>{invoice.status === 'Paid' ? 'Marked paid' : invoice.status}</span></span>
        </button>)}
        <ListPager pager={invoicePager} noun="invoice records" />
      </div>}
    </section>
    {selectedInvoice && <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-2" onClick={() => { if (!busy) setSelectedInvoice(null); }} role="dialog" aria-modal="true" aria-label="Invoice record details">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto neo-card p-6 rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between gap-4 items-start mb-6"><div className="min-w-0"><h2 className="text-xl font-bold break-words">{selectedInvoice.business_name || 'Business not recorded'}</h2><p className="text-sm text-[var(--text-secondary)]"><EventTime value={selectedInvoice.created_at} label="Created" /></p></div><button disabled={busy} onClick={() => setSelectedInvoice(null)} aria-label="Close invoice details" className="text-[var(--text-secondary)]"><X size={22} /></button></div>
        <div className="mb-6 space-y-2"><p className="text-sm text-[var(--text-secondary)]">Amount (currency not verified)</p><p className="text-3xl font-black break-words">{amountLabel(selectedInvoice.amount)}</p><p className="text-sm">Due date: {invoiceDate(selectedInvoice.due_date) ? selectedInvoice.due_date : 'Not recorded'}</p><p className="text-sm">Status: {selectedInvoice.status === 'Paid' ? 'Manually marked paid - not independently verified' : selectedInvoice.status}</p>{selectedInvoice.notes && <p className="text-sm break-words">Internal notes: {selectedInvoice.notes}</p>}</div>
        {error && <p role="alert" className="mb-3 text-sm text-red-500">{error}</p>}
        {notice && <p role="status" className="mb-3 text-sm text-[var(--text-secondary)]">{notice}</p>}
        <p className="mb-3 text-xs text-[var(--text-secondary)]">Print opens an internal record, not a complete client-ready invoice or verified receipt. Internal notes are not printed.</p>
        <div className="space-y-3"><button onClick={() => printRecord(selectedInvoice)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl neo-button text-sm"><Download size={18} /> Print or save record as PDF</button>
          {selectedInvoice.status === 'Pending' && <button disabled={busy} onClick={() => void handleMarkPaid(selectedInvoice)} className="w-full px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-medium disabled:opacity-50">Mark paid manually</button>}
          <button disabled={busy} onClick={() => void handleDeleteInvoice(selectedInvoice.id)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-500/10 text-sm disabled:opacity-50"><Trash2 size={18} /> Delete record</button></div>
      </div>
    </div>}
  </div>;
};

export default Invoices;
