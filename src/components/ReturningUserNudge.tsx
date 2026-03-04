import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Sparkles,
  ChevronRight,
  BookOpen,
  Brain,
  Zap,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function ReturningUserNudge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nudgeType, setNudgeType] = useState<'preview' | 'challenge' | 'hook'>('preview');

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings-nudge', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('courses, field_of_study')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    // Randomly pick a nudge type
    const types: ('preview' | 'challenge' | 'hook')[] = ['preview', 'challenge', 'hook'];
    setNudgeType(types[Math.floor(Math.random() * types.length)]);
  }, []);

  const studyTopic = userSettings?.field_of_study || (userSettings?.courses as string[] | null)?.[0];
  if (!studyTopic) return null;

  const handleContinue = () => {
    navigate('/lecture'); // Or deep link to the specific file/topic
  };

  const getNudgeContent = () => {
    switch (nudgeType) {
      case 'preview':
        return {
          icon: <BookOpen className="h-5 w-5 text-primary" />,
          title: "Next-Chapter Preview",
          description: `Ready to see what's next in ${studyTopic}? Let's keep the momentum!`,
          action: "See Next Topic"
        };
      case 'challenge':
        return {
          icon: <Target className="h-5 w-5 text-amber-500" />,
          title: "Mastery Challenge",
          description: `You mastered ${studyTopic} recently. Quick 3-min quiz to lock it in?`,
          action: "Start Quiz"
        };
      case 'hook':
        return {
          icon: <Zap className="h-5 w-5 text-violet-500" />,
          title: "Did you know?",
          description: `There's a crazy real-world analogy for ${studyTopic} I haven't told you yet...`,
          action: "Show Me"
        };
    }
  };

  const content = getNudgeContent();

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
      <button
        onClick={handleContinue}
        className="w-full rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 text-left transition-all hover:border-primary/40 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="h-12 w-12 text-primary" />
        </div>

        <div className="flex items-start gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
            {content.icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              {content.title}
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{content.description}</p>
            <div className="mt-2 flex items-center text-xs font-medium text-primary">
              {content.action} <ChevronRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
