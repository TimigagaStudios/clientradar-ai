import React, { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import { FileText, Plus, Download, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import Logo from '../components/Logo';

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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            body {
              font-family: 'Inter', system-ui, sans-serif;
              padding: 30px;
              background: #0F0F0F;
              color: white;
            }
            
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              background: #111;
              border-radius: 20px;
              padding: 50px;
              position: relative;
              overflow: hidden;
            }
            
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-18deg);
              opacity: 0.05;
              pointer-events: none;
              z-index: 1;
            }
            
            .watermark img {
              width: 380px;
              height: 380px;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 40px;
              position: relative;
              z-index: 2;
            }
            
            .logo {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            
            .logo-circle {
              width: 48px;
              height: 48px;
              background: #FF7A00;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 800;
              font-size: 22px;
            }
            
            .invoice-title {
              font-size: 36px;
              font-weight: 800;
              letter-spacing: -1.5px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
            }
            
            th {
              text-align: left;
              padding: 12px 0;
              border-bottom: 1px solid #333;
              color: #FF7A00;
              font-weight: 600;
            }
            
            td {
              padding: 16px 0;
              border-bottom: 1px solid #222;
            }
            
            .total {
              font-size: 20px;
              font-weight: 700;
              text-align: right;
              margin-top: 20px;
            }
            
            .orange { color: #FF7A00; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            
            <div class="watermark">
              <img src="/logo-watermark.png" alt="ClientRadar" />
            </div>

            <div class="header">
              <div class="logo">
                <div class="logo-circle">CR</div>
                <div>
                  <div style="font-weight:700; font-size:18px;">ClientRadar</div>
                  <div style="color:#FF7A00; font-size:12px;">Timigaga Studios</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="color:#FF7A00; font-weight:600;">INVOICE</div>
                <div style="font-size:20px; font-weight:700;">#${invoice.id}</div>
              </div>
            </div>

            <div class="section">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:30px;">
                <div>
                  <div style="font-size:11px; color:#888;">FROM</div>
                  <div style="font-weight:600;">Timigaga Studios</div>
                  <div style="color:#888; font-size:13px;">Lagos, Nigeria</div>
                </div>
                <div>
                  <div style="font-size:11px; color:#888;">BILL TO</div>
                  <div style="font-weight:600;">${invoice.businessName}</div>
                </div>
                <div>
                  <div style="font-size:11px; color:#888;">ISSUED</div>
                  <div>${new Date(invoice.createdAt).toLocaleDateString()}</div>
                  <div style="margin-top:12px; font-size:11px; color:#888;">DUE DATE</div>
                  <div>${new Date(invoice.dueDate).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <table>
              <tr>
                <th>Description</th>
                <th style="text-align:right">Amount</th>
              </tr>
              <tr>
                <td>Website Project</td>
                <td style="text-align:right">$${invoice.amount.toLocaleString()}</td>
              </tr>
            </table>

            <div class="total">
              Total Due: <span class="orange">$${invoice.amount.toLocaleString()}</span>
            </div>

            <div style="margin-top:50px; font-size:13px; color:#666;">
              <div>Payment Method: Bank Transfer</div>
              <div>Thank you for your business.</div>
            </div>
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
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            Invoices
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Create and manage invoices for your closed deals.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium w-full md:w-auto justify-center"
        >
          <Plus size={18} /> Create Invoice
        </button>
      </header>

      {showCreateForm && (
        <div className="neo-card p-6 md:p-8">
          <h3 className="text-xl font-bold mb-4">Create New Invoice</h3>
          <div className="grid grid-cols-1 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)]"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 mt-6">
            <button
              onClick={handleCreateInvoice}
              disabled={!selectedLeadId || !amount || !dueDate}
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-2xl font-medium disabled:opacity-50 flex-1 md:flex-none"
            >
              Create Invoice
            </button>
            <button 
              onClick={() => setShowCreateForm(false)} 
              className="px-6 py-3 neo-button rounded-2xl flex-1 md:flex-none"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              <div key={invoice.id} className="neo-in p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-[var(--text-primary)]">{invoice.businessName}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 mt-3 md:mt-0">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)]">Amount</p>
                      <p className="font-black text-lg">${invoice.amount.toLocaleString()}</p>
                    </div>

                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      invoice.status === 'Paid'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-orange-500/10 text-orange-500'
                    )}>
                      {invoice.status}
                    </span>

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

                      <button
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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