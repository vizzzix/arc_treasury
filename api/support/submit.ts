import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { handleCors } from '../_lib/cors';
import { checkRateLimit, getRateLimitHeaders } from '../_lib/rateLimit';
import { escapeHtml } from '../_lib/validate';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Resend for email notifications
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SUPPORT_EMAIL = 'info@arctreasury.biz';

/**
 * API Endpoint: /api/support/submit
 * Submit a support request
 *
 * POST body: {
 *   category: string,
 *   name: string,
 *   email: string,
 *   subject: string,
 *   message: string,
 *   walletAddress?: string
 * }
 */
export default async function handler(request: any, response: any) {
  if (handleCors(request, response)) return;

  const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const rlKey = `support:${clientIp}`;
  if (!checkRateLimit(rlKey, 3, 60_000)) {
    const headers = getRateLimitHeaders(rlKey, 3);
    Object.entries(headers).forEach(([k, v]: [string, string]) => response.setHeader(k, v));
    return response.status(429).json({ error: 'Too many requests' });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, name, email, subject, message, walletAddress } = request.body;

    // Validate required fields
    if (!category || !name || !email || !subject || !message) {
      return response.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: 'Invalid email format' });
    }

    // Validate category
    const validCategories = ['general', 'technical', 'partnership', 'bug', 'feature'];
    if (!validCategories.includes(category)) {
      return response.status(400).json({ error: 'Invalid category' });
    }

    // Validate message length
    if (message.length > 1000) {
      return response.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    // Validate wallet address format if provided
    if (walletAddress) {
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addressRegex.test(walletAddress)) {
        return response.status(400).json({ error: 'Invalid wallet address format' });
      }
    }

    // Insert support request into database
    const { data, error } = await supabase
      .from('support_requests')
      .insert([{
        category,
        name,
        email,
        subject,
        message,
        wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
        status: 'open',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return response.status(500).json({ error: 'Failed to submit support request' });
    }

    // Send email notification
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Arc Treasury <noreply@arctreasury.biz>',
          to: SUPPORT_EMAIL,
          replyTo: email,
          subject: `[${category.toUpperCase()}] ${subject}`,
          html: `
            <h2>New Support Request</h2>
            <p><strong>Category:</strong> ${escapeHtml(category)}</p>
            <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
            ${walletAddress ? `<p><strong>Wallet:</strong> ${escapeHtml(walletAddress)}</p>` : ''}
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            <hr />
            <p><small>Submitted at: ${new Date().toISOString()}</small></p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    return response.status(200).json({
      success: true,
      message: 'Support request submitted successfully',
      data: {
        id: data.id,
        category: data.category,
      },
    });
  } catch (error) {
    console.error('Error submitting support request:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
