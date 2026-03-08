import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, Trophy, Medal, Star, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StarRating from '@/components/StarRating';

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get current user's field of study
  const { data: mySettings } = useQuery({
    queryKey: ['my-settings-leaderboard', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('field_of_study, university')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', mySettings?.field_of_study],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        _field_of_study: mySettings!.field_of_study!,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!mySettings?.field_of_study,
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/15 to-yellow-500/5 border-yellow-500/25';
    if (index === 1) return 'bg-gradient-to-r from-gray-400/10 to-gray-400/5 border-gray-400/20';
    if (index === 2) return 'bg-gradient-to-r from-amber-600/10 to-amber-600/5 border-amber-600/20';
    return 'bg-card border-border';
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" /> Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">
              {mySettings?.field_of_study || 'Set your field of study in Settings'}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-3">
        {!mySettings?.field_of_study ? (
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <Trophy className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="font-display font-semibold mb-1">Set up your profile first</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your field of study in Settings to see your department ranking.</p>
            <button
              onClick={() => navigate('/settings?tab=profile')}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
            >
              Go to Settings
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry: any, index: number) => {
              const isMe = entry.user_id === user?.id;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${getRankBg(index)} ${isMe ? 'ring-2 ring-primary/40' : ''}`}
                >
                  <div className="flex-shrink-0 w-8 flex justify-center">
                    {getRankIcon(index)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                    {(entry.preferred_name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {entry.preferred_name || 'Student'} {isMe && <span className="text-xs text-primary">(You)</span>}
                    </h4>
                    <div className="flex items-center gap-2">
                      <StarRating rating={Number(entry.star_rating)} />
                      <span className="text-xs text-muted-foreground">{entry.total_quizzes_taken} quizzes</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{Number(entry.star_rating).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">⭐</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border p-10 text-center">
            <Trophy className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="font-display font-semibold mb-1">No rankings yet</h3>
            <p className="text-sm text-muted-foreground">Be the first in {mySettings.field_of_study} to earn stars!</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
