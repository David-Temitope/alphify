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

  const { data: userData } = useQuery({
    queryKey: ['user-nudge-data', user?.id],
    queryFn: async () => {
      const [settingsRes, lastExamRes] = await Promise.all([
        supabase
          .from('user_settings')
          .select('courses, field_of_study, preferred_name')
          .eq('user_id', user!.id)
          .maybeSingle(),
        supabase
          .from('exam_attempts')
          .select('course, score, max_score')
          .eq('user_id', user!.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      return {
        settings: settingsRes.data,
        lastExam: lastExamRes.data
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    // Randomly pick a nudge type
    const types: ('preview' | 'challenge' | 'hook')[] = ['preview', 'challenge', 'hook'];
    setNudgeType(types[Math.floor(Math.random() * types.length)]);
  }, []);

  const studyTopic = userData?.settings?.field_of_study || (userData?.settings?.courses as string[] | null)?.[0];
  const preferredName = userData?.settings?.preferred_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Student';

  if (!studyTopic && !userData?.lastExam) return null;

  const getNudgeContent = () => {
    const lastExam = userData?.lastExam;

    // Priority: If they just finished an exam, talk about it
    if (lastExam && Math.random() > 0.4) {
      const percentage = Math.round((lastExam.score! / lastExam.max_score) * 100);
      if (percentage >= 70) {
        return {
          icon: <Sparkles className="h-5 w-5 text-primary" />,
          title: "Outstanding Performance!",
          description: `Excellent work on that ${lastExam.course} test, ${preferredName}! ${percentage}% is impressive. Ready for the next one?`,
          action: "Next Challenge",
          path: "/exam"
        };
      } else {
        return {
          icon: <Target className="h-5 w-5 text-amber-500" />,
          title: "Room for Growth",
          description: `${preferredName}, I saw the ${lastExam.course} score. No worries, even the best lecturers started somewhere! Let's review the tricky parts?`,
          action: "Review Topic",
          path: "/lecture"
        };
      }
    }

    switch (nudgeType) {
      case 'preview':
        return {
          icon: <BookOpen className="h-5 w-5 text-primary" />,
          title: "Lecturer's Insight",
          description: `Hey ${preferredName}, did you know the next part of ${studyTopic} is usually the most failed in exams? Let's master it now.`,
          action: "Start Lecture",
          path: "/lecture"
        };
      case 'challenge':
        return {
          icon: <Brain className="h-5 w-5 text-violet-500" />,
          title: "Pop Quiz!",
          description: `${preferredName}, let's see if you still remember those key concepts from ${studyTopic}. Quick drill?`,
          action: "Take Quiz",
          path: "/exam"
        };
      case 'hook':
      default:
        return {
          icon: <Zap className="h-5 w-5 text-amber-500" />,
          title: "Did you know?",
          description: `There's a real-world hack for ${studyTopic} that'll make your next exam a breeze, ${preferredName}. Want to see?`,
          action: "Show Me",
          path: "/lecture"
        };
    }
  };

  const content = getNudgeContent();

  const handleContinue = () => {
    navigate(content.path);
  };

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
