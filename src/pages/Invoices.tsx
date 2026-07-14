import React, { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import { FileText, Plus, Download, Trash2, X } from 'lucide-react';
import { cn } from '../utils/cn';

type Invoice = {
  id: string;
  leadId: string;
  businessName: string;
  amount: number;
  status: 'Pending' | 'Paid';
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    localStorage.setItem('clientradar_invoices', JSON.stringify(invoices));
  }, [invoices]);

  const dealLeads = leads.filter((lead: any) =>
    ['Interested', 'Negotiating', 'Deal Closed'].includes(lead.status)
  );

  const handleCreateInvoice = () => {
    if (!selectedLeadId || !amount) return;

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
        createdAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      };

      setInvoices([newInvoice, ...invoices]);
      setShowCreateForm(false);
      setSelectedLeadId('');
      setAmount('');
      setNotes('');
      setIsCreating(false);
    }, 400);
  };

  const handleMarkPaid = (id: string) => {
    setInvoices(invoices.map(inv =>
      inv.id === id ? { ...inv, status: 'Paid' as const } : inv
    ));
    if (selectedInvoice && selectedInvoice.id === id) {
      setSelectedInvoice({ ...selectedInvoice, status: 'Paid' });
    }
  };

  const handleDeleteInvoice = (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    setInvoices(invoices.filter(inv => inv.id !== id));
    setSelectedInvoice(null);
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
            .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; }
            .logo img { width: 48px; height: 48px; border-radius: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th { text-align: left; padding: 12px 0; border-bottom: 1px solid #333; color: #FF7A00; }
            .total { font-size: 20px; font-weight: 700; text-align: right; }
            .orange { color: #FF7A00; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <img src="/icons/icon-192.png" alt="ClientRadar Logo" />
              <div>
                <strong>ClientRadar</strong><br>
                <span style="color:#FF7A00; font-size:12px;">Timigaga Studios</span>
              </div>
            </div>
            
            <h2>Invoice #${invoice.id}</h2>
            <p><strong>Bill To:</strong> ${invoice.businessName}</p>
            <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            
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

            <input
              type="number"
              placeholder="Invoice Amount ($)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)]"
            />

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
              disabled={!selectedLeadId || !amount || isCreating}
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

      {/* Invoice History - Transaction List Style */}
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
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                className="flex items-center justify-between p-4 rounded-2xl neo-in active:bg-black/5 dark:active:bg-white/5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-bold text-sm">
                    {invoice.businessName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{invoice.businessName}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-[var(--text-primary)]">${invoice.amount.toLocaleString()}</p>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    invoice.status === 'Paid' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                  )}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={() => setSelectedInvoice(null)}>
          <div 
            className="w-full max-w-md neo-card p-6 rounded-t-3xl md:rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold">{selectedInvoice.businessName}</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-[var(--text-secondary)]">
                <X size={22} />
              </button>
            </div>

            <div className="text-center mb-8">
              <p className="text-sm text-[var(--text-secondary)]">Total Amount</p>
              <p className="text-4xl font-black mt-1">${selectedInvoice.amount.toLocaleString()}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => generatePDF(selectedInvoice)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl neo-button text-sm"
              >
                <Download size={18} /> Download PDF
              </button>

              {selectedInvoice.status === 'Pending' && (
                <button
                  onClick={() => handleMarkPaid(selectedInvoice.id)}
                  className="w-full px-4 py-3 rounded-2xl bg-green-600 text-white text-sm font-medium"
                >
                  Mark as Paid
                </button>
              )}

              <button
                onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-500/10 text-sm"
              >
                <Trash2 size={18} /> Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;