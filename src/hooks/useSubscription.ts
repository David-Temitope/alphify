import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'premium';

export interface SubscriptionLimits {
  maxLibraryFiles: number;
  maxChatsPerDay: number;
  maxPromptsPerChat: number;
  canCreateStudyGroup: boolean;
  canUploadExamSample: boolean;
  hasPremiumBadge: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, SubscriptionLimits> = {
  free: {
    maxLibraryFiles: 0,
    maxChatsPerDay: 0,
    maxPromptsPerChat: 0,
    canCreateStudyGroup: false,
    canUploadExamSample: false,
    hasPremiumBadge: false,
  },
  basic: {
    maxLibraryFiles: 2,
    maxChatsPerDay: 1,
    maxPromptsPerChat: 15,
    canCreateStudyGroup: false,
    canUploadExamSample: false,
    hasPremiumBadge: false,
  },
  pro: {
    maxLibraryFiles: 5,
    maxChatsPerDay: 3,
    maxPromptsPerChat: 25,
    canCreateStudyGroup: true,
    canUploadExamSample: true,
    hasPremiumBadge: false,
  },
  premium: {
    maxLibraryFiles: Infinity,
    maxChatsPerDay: Infinity,
    maxPromptsPerChat: Infinity,
    canCreateStudyGroup: true,
    canUploadExamSample: true,
    hasPremiumBadge: true,
  },
};

export const PLAN_PRICES: Record<Exclude<SubscriptionPlan, 'free'>, number> = {
  basic: 300000, // 3000 Naira in kobo
  pro: 500000,   // 5000 Naira in kobo
  premium: 1000000, // 10000 Naira in kobo
};

export const PLAN_DISPLAY_PRICES: Record<SubscriptionPlan, string> = {
  free: '₦0',
  basic: '₦3,000',
  pro: '₦5,000',
  premium: '₦10,000',
};

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  paystack_customer_code: string | null;
  paystack_subscription_code: string | null;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  date: string;
  chats_started: number;
  prompts_today: Record<string, number>; // conversation_id -> prompt count
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user,
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-tracking', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as UsageTracking | null;
    },
    enabled: !!user,
  });

  const currentPlan: SubscriptionPlan = 
    (subscription?.status === 'active' ? subscription.plan : 'free') as SubscriptionPlan;
  
  const limits = PLAN_LIMITS[currentPlan];

  const canStartNewChat = () => {
    if (limits.maxChatsPerDay === Infinity) return true;
    const chatsToday = usage?.chats_started || 0;
    return chatsToday < limits.maxChatsPerDay;
  };

  const canSendPrompt = (conversationId: string) => {
    if (limits.maxPromptsPerChat === Infinity) return true;
    const promptsInChat = usage?.prompts_today?.[conversationId] || 0;
    return promptsInChat < limits.maxPromptsPerChat;
  };

  const getPromptsRemaining = (conversationId: string) => {
    if (limits.maxPromptsPerChat === Infinity) return Infinity;
    const promptsInChat = usage?.prompts_today?.[conversationId] || 0;
    return Math.max(0, limits.maxPromptsPerChat - promptsInChat);
  };

  const getChatsRemaining = () => {
    if (limits.maxChatsPerDay === Infinity) return Infinity;
    const chatsToday = usage?.chats_started || 0;
    return Math.max(0, limits.maxChatsPerDay - chatsToday);
  };

  const incrementChatCount = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      
      if (usage) {
        const { error } = await supabase
          .from('usage_tracking')
          .update({ chats_started: (usage.chats_started || 0) + 1 })
          .eq('user_id', user.id)
          .eq('date', today);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('usage_tracking')
          .insert({ user_id: user.id, date: today, chats_started: 1, prompts_today: {} });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage-tracking', user?.id] });
    },
  });

  const incrementPromptCount = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      
      const currentPrompts = usage?.prompts_today || {};
      const newPrompts = {
        ...currentPrompts,
        [conversationId]: (currentPrompts[conversationId] || 0) + 1,
      };
      
      if (usage) {
        const { error } = await supabase
          .from('usage_tracking')
          .update({ prompts_today: newPrompts })
          .eq('user_id', user.id)
          .eq('date', today);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('usage_tracking')
          .insert({ user_id: user.id, date: today, chats_started: 0, prompts_today: newPrompts });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage-tracking', user?.id] });
    },
  });

  return {
    subscription,
    usage,
    currentPlan,
    limits,
    isLoading: subscriptionLoading || usageLoading,
    canStartNewChat,
    canSendPrompt,
    getPromptsRemaining,
    getChatsRemaining,
    incrementChatCount,
    incrementPromptCount,
    isSubscribed: subscription?.status === 'active',
  };
}
