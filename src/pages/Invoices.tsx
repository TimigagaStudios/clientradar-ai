// ... (previous imports remain the same)

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
          
          .section {
            margin-bottom: 35px;
            position: relative;
            z-index: 2;
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
          
          <!-- Watermark -->
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
              <div>#${invoice.id}</div>
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

// ... rest of the component remains the same