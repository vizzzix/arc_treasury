import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, walletAddress } = request.body;

    if (!email || !walletAddress) {
      return response.status(400).json({ error: 'Email and wallet address required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: 'Invalid email format' });
    }

    // Validate wallet address
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(walletAddress)) {
      return response.status(400).json({ error: 'Invalid wallet address' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing codes for this wallet/email
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('wallet_address', walletAddress.toLowerCase());

    // Store code in Supabase
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

    // Send email via Resend
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
