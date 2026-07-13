import React, { useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { FileText, Plus, Download, Calendar, DollarSign } from 'lucide-react';
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const dealLeads = leads.filter((lead: any) =>
    ['Interested', 'Negotiating', 'Deal Closed'].includes(lead.status)
  );

  const handleCreateInvoice = () => {
    if (!selectedLeadId || !amount || !dueDate) return;

    const lead = leads.find((l: any) => l.id === selectedLeadId);
    if (!lead) return;

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
  };

  const handleMarkPaid = (id: string) => {
    setInvoices(invoices.map(inv =>
      inv.id === id ? { ...inv, status: 'Paid' as const } : inv
    ));
  };

  const generatePDF = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Invoice - ${invoice.businessName}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #111; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: 800; }
            .info { text-align: right; }
            .section { margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .total { font-size: 20px; font-weight: 700; }
            .footer { margin-top: 60px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">INVOICE</div>
              <div>Timigaga Studios</div>
            </div>
            <div class="info">
              <div><strong>Invoice #${invoice.id}</strong></div>
              <div>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div class="section">
            <strong>Bill To:</strong><br>
            ${invoice.businessName}<br>
            ${invoice.notes || ''}
          </div>

          <table>
            <tr>
              <th>Description</th>
              <th>Due Date</th>
              <th>Amount</th>
            </tr>
            <tr>
              <td>Website Project</td>
              <td>${new Date(invoice.dueDate).toLocaleDateString()}</td>
              <td>$${invoice.amount.toLocaleString()}</td>
            </tr>
          </table>

          <div style="margin-top: 40px; text-align: right;">
            <div class="total">Total Due: $${invoice.amount.toLocaleString()}</div>
          </div>

          <div class="footer">
            Payment is due by the due date above.<br>
            Thank you for your business.
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            Invoices
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Create and manage invoices for your closed deals.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium"
        >
          <Plus size={18} /> Create Invoice
        </button>
      </header>

      {/* Create Invoice Form */}
      {showCreateForm && (
        <div className="neo-card p-6 md:p-8">
          <h3 className="text-xl font-bold mb-4">Create New Invoice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"
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
              className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"
            />

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"
            />

            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCreateInvoice}
              disabled={!selectedLeadId || !amount || !dueDate}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium disabled:opacity-50"
            >
              Create Invoice
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-6 py-3 neo-button rounded-2xl">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invoice History */}
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
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="neo-in p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-[var(--text-primary)]">{invoice.businessName}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Amount</p>
                    <p className="font-black text-lg">${invoice.amount.toLocaleString()}</p>
                  </div>

                  <div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      invoice.status === 'Paid'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-orange-500/10 text-orange-500'
                    )}>
                      {invoice.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => generatePDF(invoice)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl neo-button text-sm"
                    >
                      <Download size={16} /> PDF
                    </button>

                    {invoice.status === 'Pending' && (
                      <button
                        onClick={() => handleMarkPaid(invoice.id)}
                        className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
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