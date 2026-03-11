import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Coins, TrendingDown, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface KUTransaction {
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function KUConsumptionDashboard({ userId }: { userId?: string }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['ku-transactions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('ku_transactions')
        .select('amount, type, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as KUTransaction[];
    },
    enabled: !!userId,
  });

  const last7Days = transactions.filter(t => 
    new Date(t.created_at) > subDays(new Date(), 7) && t.amount < 0
  );
  
  const totalSpent = last7Days.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const byType = last7Days.reduce((acc, t) => {
    const type = t.type || 'other';
    acc[type] = (acc[type] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const typeLabels: Record<string, string> = {
    chat_prompt: 'Ask Ezra',
    assignment_assist: 'Assignment Assist',
    response_length_charge: 'Extended Responses',
    file_upload: 'File Uploads',
    group_prompt: 'Group Sessions',
    welcome_bonus: 'Welcome Bonus',
    purchase: 'Purchased',
    referral_bonus: 'Referral Bonus',
  };

  const recentSpending = transactions.filter(t => t.amount < 0).slice(0, 10);

  if (!userId) return null;

  return (
    <section className="p-4 rounded-2xl bg-card border border-border space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold">KU Usage (Last 7 Days)</h2>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <TrendingDown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{totalSpent} KU</p>
          <p className="text-xs text-muted-foreground">spent this week</p>
        </div>
      </div>

      {/* Breakdown by type */}
      {Object.keys(byType).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Breakdown</p>
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{typeLabels[type] || type}</span>
              <span className="font-medium text-foreground">{amount} KU</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {recentSpending.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Recent Activity</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {recentSpending.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{t.description || typeLabels[t.type] || t.type}</p>
                  <p className="text-muted-foreground">{format(new Date(t.created_at), 'MMM d, h:mm a')}</p>
                </div>
                <span className="text-destructive font-medium ml-2 flex-shrink-0">{t.amount} KU</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalSpent === 0 && (
        <div className="text-center py-4">
          <Coins className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No KU spent this week. Start learning!</p>
        </div>
      )}
    </section>
  );
}
