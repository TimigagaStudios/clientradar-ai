import React, { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import { FileText, Plus, Download, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

type Invoice = {
  id: string;
  leadId: string;
  businessName: string;
  amount: number;
  status: 'Pending' | 'Paid';
  dueDate: string;
  createdAt: string;
  notes?: string;
};

const Invoices = () => {
  const { leads } = useLeads() as any;

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('clientradar_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    localStorage.setItem('clientradar_invoices', JSON.stringify(invoices));
  }, [invoices]);

  const dealLeads = leads.filter((lead: any) =>
    ['Interested', 'Negotiating', 'Deal Closed'].includes(lead.status)
  );

  const handleCreateInvoice = () => {
    if (!selectedLeadId || !amount || !dueDate) return;

    const lead = leads.find((l: any) => l.id === selectedLeadId);
    if (!lead) return;

    setIsCreating(true);

    setTimeout(() => {
      const newInvoice: Invoice = {
        id: Date.now().toString(),
        leadId: selectedLeadId,
        businessName: lead.businessName,
        amount: Number(amount),
        status: 'Pending',
        dueDate,
        createdAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      };

      setInvoices([newInvoice, ...invoices]);
      setShowCreateForm(false);
      setSelectedLeadId('');
      setAmount('');
      setDueDate('');
      setNotes('');
      setIsCreating(false);
    }, 500);
  };

  const handleMarkPaid = (id: string) => {
    setInvoices(invoices.map(inv =>
      inv.id === id ? { ...inv, status: 'Paid' as const } : inv
    ));
  };

  const handleDeleteInvoice = (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    setInvoices(invoices.filter(inv => inv.id !== id));
  };

  const generatePDF = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Invoice - ${invoice.businessName}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 30px; background: #0F0F0F; color: white; }
            .container { max-width: 800px; margin: 0 auto; background: #111; border-radius: 20px; padding: 40px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .logo { display: flex; align-items: center; gap: 12px; }
            .logo-circle { width: 48px; height: 48px; background: #FF7A00; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 22px; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th { text-align: left; padding: 12px 0; border-bottom: 1px solid #333; color: #FF7A00; }
            .total { font-size: 20px; font-weight: 700; text-align: right; }
            .orange { color: #FF7A00; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                <div class="logo-circle">CR</div>
                <div><strong>ClientRadar</strong><br><span style="color:#FF7A00; font-size:12px;">Timigaga Studios</span></div>
              </div>
              <div style="text-align:right;">
                <div style="color:#FF7A00; font-weight:600;">INVOICE</div>
                <div>#${invoice.id}</div>
              </div>
            </div>

            <div style="margin-bottom:30px;">
              <strong>Bill To:</strong> ${invoice.businessName}<br>
              <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}
            </div>

            <table>
              <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
              <tr><td>Website Project</td><td style="text-align:right">$${invoice.amount.toLocaleString()}</td></tr>
            </table>

            <div class="total">Total Due: <span class="orange">$${invoice.amount.toLocaleString()}</span></div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Invoices</h1>
          <p className="text-[var(--text-secondary)] font-medium">Create and manage invoices for your closed deals.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium w-full md:w-auto justify-center"
        >
          <Plus size={18} /> Create Invoice
        </button>
      </header>

      {/* Create Form */}
      {showCreateForm && (
        <div className="neo-card p-6 md:p-8">
          <h3 className="text-xl font-bold mb-5">Create New Invoice</h3>
          <div className="space-y-4">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)]"
            >
              <option value="">Select a deal...</option>
              {dealLeads.map((lead: any) => (
                <option key={lead.id} value={lead.id}>
                  {lead.businessName} â€” ${Number(lead.dealValue || 0).toLocaleString()}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Invoice Amount ($)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)]"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)]"
              />
            </div>

            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)]"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 mt-6">
            <button
              onClick={handleCreateInvoice}
              disabled={!selectedLeadId || !amount || !dueDate || isCreating}
              className="px-6 py-3.5 bg-[var(--accent)] text-white rounded-2xl font-medium disabled:opacity-50 flex-1 md:flex-none"
            >
              {isCreating ? "Creating..." : "Create Invoice"}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-6 py-3.5 neo-button rounded-2xl flex-1 md:flex-none">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invoice History - Compact Row Style */}
      <div className="neo-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={20} className="text-[var(--accent)]" />
          <h3 className="text-xl font-bold">Invoice History</h3>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            No invoices created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="neo-in p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{invoice.businessName}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Amount</p>
                    <p className="text-xl font-black">${invoice.amount.toLocaleString()}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    invoice.status === 'Paid' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                  )}>
                    {invoice.status}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => generatePDF(invoice)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl neo-button text-sm">
                    <Download size={16} /> PDF
                  </button>
                  {invoice.status === 'Pending' && (
                    <button onClick={() => handleMarkPaid(invoice.id)} className="flex-1 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium">
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Invoices;