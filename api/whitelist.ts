import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
// Используем anon key для API (безопаснее, работает с RLS)
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Supabase storage function
async function saveToSupabase(email: string, ip?: string): Promise<void> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured. Please set SUPABASE_URL environment variable.');
  }

  const { error } = await supabase
    .from('whitelist')
    .insert([{ 
      email: email.toLowerCase(), 
      created_at: new Date().toISOString(),
      ip_address: ip 
    }]);

  if (error) {
    // PostgreSQL unique constraint violation error code
    if (error.code === '23505') {
      throw new Error('Email already exists');
    }
    console.error('Supabase error:', error);
    throw new Error(`Failed to save email: ${error.message}`);
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = request.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return response.status(400).json({ error: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: 'Invalid email format' });
    }

    // Get IP address (for logging)
    const ip = request.headers['x-forwarded-for'] || 
               request.headers['x-real-ip'] || 
               request.socket.remoteAddress || 
               'unknown';

    // Save email to Supabase
    try {
      await saveToSupabase(email, typeof ip === 'string' ? ip : ip[0]);

      return response.status(200).json({ 
        success: true, 
        message: 'Email added to whitelist',
      });
    } catch (error: any) {
      if (error.message === 'Email already exists') {
        return response.status(409).json({ 
          error: 'This email is already on the whitelist' 
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error processing whitelist request:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

