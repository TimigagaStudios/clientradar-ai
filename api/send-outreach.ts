import type { VercelRequest, VercelResponse } from '@vercel/node';

const BREVO_API_KEY = process.env.BREVO_API_KEY as string;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME as string;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    if (!BREVO_API_KEY || !BREVO_SENDER_NAME || !BREVO_SENDER_EMAIL) {
      return res.status(500).json({
        success: false,
        error: 'Missing Brevo environment variables',
      });
    }

    const { toEmail, toName, subject, body } = req.body;

    if (!toEmail || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'toEmail, subject, and body are required',
      });
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: [
          {
            email: toEmail,
            name: toName || 'Lead',
          },
        ],
        subject,
        htmlContent: `
          <div style="font-family: Inter, Arial, sans-serif; color: #111111; line-height: 1.7;">
            ${body.replace(/\n/g, '<br>')}
          </div>
        `,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: result?.message || 'Failed to send outreach email',
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('send-outreach error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
