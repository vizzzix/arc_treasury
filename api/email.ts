import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_lib/cors';
import { checkRateLimit, getRateLimitHeaders } from './_lib/rateLimit';

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const addressRegex = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(request: any, response: any) {
  if (handleCors(request, response)) return;

  const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const rlKey = `email:${clientIp}`;
  if (!checkRateLimit(rlKey, 5, 60_000)) {
    const headers = getRateLimitHeaders(rlKey, 5);
    Object.entries(headers).forEach(([k, v]: [string, string]) => response.setHeader(k, v));
    return response.status(429).json({ error: 'Too many requests' });
  }

  const { action } = request.query;

  switch (action) {
    case 'send-code':
      return handleSendCode(request, response);
    case 'verify-code':
      return handleVerifyCode(request, response);
    default:
      return response.status(400).json({ error: 'Invalid action. Use: send-code, verify-code' });
  }
}

async function handleSendCode(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, walletAddress } = request.body;

    if (!email || !walletAddress) {
      return response.status(400).json({ error: 'Email and wallet address required' });
    }

    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: 'Invalid email format' });
    }

    if (!addressRegex.test(walletAddress)) {
      return response.status(400).json({ error: 'Invalid wallet address' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('wallet_address', walletAddress.toLowerCase());

    const { error: dbError } = await supabase
      .from('email_verification_codes')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        email: email.toLowerCase(),
        code,
        expires_at: expiresAt,
      });

    if (dbError) {
      console.error('Supabase error:', dbError);
      return response.status(500).json({ error: 'Failed to store verification code' });
    }

    await resend.emails.send({
      from: 'Arc Treasury <noreply@arctreasury.biz>',
      to: email,
      subject: 'Your Arc Treasury Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Arc Treasury</h2>
          <p>Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });

    return response.status(200).json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return response.status(500).json({ error: 'Failed to send verification email' });
  }
}

async function handleVerifyCode(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, walletAddress, code } = request.body;

    if (!email || !walletAddress || !code) {
      return response.status(400).json({ error: 'Email, wallet address, and code required' });
    }

    const { data, error: dbError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('email', email.toLowerCase())
      .single();

    if (dbError || !data) {
      return response.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    if (new Date(data.expires_at) < new Date()) {
      await supabase
        .from('email_verification_codes')
        .delete()
        .eq('wallet_address', walletAddress.toLowerCase());
      return response.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    const attempts = (data.attempts || 0) + 1;
    if (data.code !== code) {
      if (attempts >= 5) {
        await supabase
          .from('email_verification_codes')
          .delete()
          .eq('wallet_address', walletAddress.toLowerCase());
        return response.status(400).json({ error: 'Too many failed attempts. Request a new code.' });
      }
      await supabase
        .from('email_verification_codes')
        .update({ attempts })
        .eq('wallet_address', walletAddress.toLowerCase());
      return response.status(400).json({ error: 'Invalid verification code' });
    }

    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('wallet_address', walletAddress.toLowerCase());

    return response.status(200).json({
      success: true,
      message: 'Email verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    return response.status(500).json({ error: 'Failed to verify code' });
  }
}
