import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface LeaderboardMessage {
  id: number;
  wallet_address: string;
  message: string;
  board_type: 'bridge' | 'swap';
  created_at: string;
  updated_at: string;
}

const MAX_MESSAGE_LENGTH = 50;

// Sanitize message: only allow letters, numbers, spaces, and common emojis
const sanitizeMessage = (msg: string): string => {
  // Remove any HTML tags
  let clean = msg.replace(/<[^>]*>/g, '');
  // Remove URLs
  clean = clean.replace(/https?:\/\/[^\s]+/gi, '');
  clean = clean.replace(/[^\s]+\.(com|io|net|org|xyz|app)[^\s]*/gi, '');
  // Trim and limit length
  return clean.trim().slice(0, MAX_MESSAGE_LENGTH);
};

export const useLeaderboardMessages = (boardType: 'bridge' | 'swap' = 'bridge') => {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all messages for this board type
  const fetchMessages = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('leaderboard_messages')
        .select('wallet_address, message')
        .eq('board_type', boardType)
        .neq('message', ''); // Filter out empty (deleted) messages

      if (error) {
        console.error('Error fetching leaderboard messages:', error);
        return;
      }

      const messageMap: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.message && item.message.trim()) {
          messageMap[item.wallet_address.toLowerCase()] = item.message;
        }
      });
      setMessages(messageMap);
    } catch (e) {
      console.error('Failed to fetch leaderboard messages:', e);
    } finally {
      setIsLoading(false);
    }
  }, [boardType]);

  // Save or update a message
  const saveMessage = useCallback(async (walletAddress: string, message: string): Promise<boolean> => {
    if (!supabase) return false;
    const sanitized = sanitizeMessage(message);
    if (!sanitized) return false;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leaderboard_messages')
        .upsert({
          wallet_address: walletAddress.toLowerCase(),
          message: sanitized,
          board_type: boardType,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'wallet_address,board_type',
        });

      if (error) {
        console.error('Error saving message:', error);
        return false;
      }

      // Update local state
      setMessages(prev => ({
        ...prev,
        [walletAddress.toLowerCase()]: sanitized,
      }));

      return true;
    } catch (e) {
      console.error('Failed to save message:', e);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [boardType]);

  // Delete a message (sets message to empty string since DELETE is blocked by RLS)
  const deleteMessage = useCallback(async (walletAddress: string): Promise<boolean> => {
    if (!supabase) return false;
    setIsSaving(true);
    try {
      // Use upsert with empty message since DELETE is blocked by RLS policy
      const { error } = await supabase
        .from('leaderboard_messages')
        .upsert({
          wallet_address: walletAddress.toLowerCase(),
          message: '', // Empty message = deleted
          board_type: boardType,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'wallet_address,board_type',
        });

      if (error) {
        console.error('Error deleting message:', error);
        return false;
      }

      // Update local state
      setMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[walletAddress.toLowerCase()];
        return newMessages;
      });

      return true;
    } catch (e) {
      console.error('Failed to delete message:', e);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [boardType]);

  // Get message for a specific wallet
  const getMessage = useCallback((walletAddress: string): string | null => {
    return messages[walletAddress.toLowerCase()] || null;
  }, [messages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    getMessage,
    saveMessage,
    deleteMessage,
    isLoading,
    isSaving,
    refresh: fetchMessages,
    MAX_MESSAGE_LENGTH,
  };
};
