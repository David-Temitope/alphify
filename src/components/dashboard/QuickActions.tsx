import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import {
  MessageSquarePlus,
  BookOpen,
  GraduationCap,
  FileText,
  Sparkles,
  TrendingUp,
  Trophy,
  ClipboardList,
  FolderKanban,
} from 'lucide-react';

interface QuickActionsProps {
  fileCount: number;
}

export default function QuickActions({ fileCount }: QuickActionsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, canChat } = useKnowledgeUnits();

  const handleNewChat = () => {
    if (!canChat) {
      toast({
        title: 'No Knowledge Units',
        description: 'You need at least 1 KU to chat with Ezra. Top up your wallet!',
        variant: 'destructive',
      });
      navigate('/settings?tab=wallet');
      return;
    }
    navigate('/chat');
  };

  const primaryActions = [
    {
      label: 'Ask Ezra',
      subtitle: 'Quick help',
      icon: MessageSquarePlus,
      color: 'primary',
      onClick: handleNewChat,
    },
    {
      label: 'Lecture Mode',
      subtitle: 'Master topics',
      icon: BookOpen,
      color: 'indigo-500',
      onClick: () => navigate('/lecture'),
    },
    {
      label: 'Exam Mode',
      subtitle: 'Practice tests',
      icon: GraduationCap,
      color: 'amber-500',
      onClick: () => navigate('/exam'),
    },
    {
      label: 'Library',
      subtitle: `${fileCount} docs`,
      icon: FileText,
      color: 'blue-500',
      onClick: () => navigate('/library'),
    },
  ];

  const secondaryActions = [
    {
      label: 'Assignment',
      subtitle: 'Homework help',
      icon: ClipboardList,
      color: 'emerald-500',
      onClick: () => {
        if (balance < 2) {
          toast({ title: 'Not enough KU', description: 'Assignment mode requires at least 2 KU.', variant: 'destructive' });
          navigate('/settings?tab=wallet');
          return;
        }
        navigate('/chat?mode=assignment');
      },
    },
    {
      label: 'Project',
      subtitle: 'Deep research',
      icon: FolderKanban,
      color: 'purple-500',
      onClick: () => {
        if (balance < 5) {
          toast({ title: 'Not enough KU', description: 'Project mode requires at least 5 KU. Top up first!', variant: 'destructive' });
          navigate('/settings?tab=wallet');
          return;
        }
        navigate('/chat?mode=project');
      },
    },
    {
      label: 'Community',
      subtitle: 'Study mates',
      icon: Sparkles,
      color: 'violet-500',
      onClick: () => navigate('/community'),
    },
    {
      label: 'Progress',
      subtitle: 'Your stats',
      icon: TrendingUp,
      color: 'rose-500',
      onClick: () => navigate('/progress'),
    },
    {
      label: 'Leaderboard',
      subtitle: 'Rankings',
      icon: Trophy,
      color: 'yellow-500',
      onClick: () => navigate('/leaderboard'),
    },
  ];

  const getColorClasses = (color: string) => {
    const map: Record<string, { bg: string; icon: string; border: string }> = {
      'primary': { bg: 'bg-primary/15', icon: 'text-primary', border: 'border-primary/20 hover:border-primary/40' },
      'indigo-500': { bg: 'bg-indigo-500/15', icon: 'text-indigo-500', border: 'border-indigo-500/20 hover:border-indigo-500/40' },
      'amber-500': { bg: 'bg-amber-500/15', icon: 'text-amber-500', border: 'border-amber-500/20 hover:border-amber-500/40' },
      'blue-500': { bg: 'bg-blue-500/15', icon: 'text-blue-500', border: 'border-blue-500/20 hover:border-blue-500/40' },
      'emerald-500': { bg: 'bg-emerald-500/15', icon: 'text-emerald-500', border: 'border-emerald-500/20 hover:border-emerald-500/40' },
      'purple-500': { bg: 'bg-purple-500/15', icon: 'text-purple-500', border: 'border-purple-500/20 hover:border-purple-500/40' },
      'violet-500': { bg: 'bg-violet-500/15', icon: 'text-violet-500', border: 'border-violet-500/20 hover:border-violet-500/40' },
      'rose-500': { bg: 'bg-rose-500/15', icon: 'text-rose-500', border: 'border-rose-500/20 hover:border-rose-500/40' },
      'yellow-500': { bg: 'bg-yellow-500/15', icon: 'text-yellow-500', border: 'border-yellow-500/20 hover:border-yellow-500/40' },
    };
    return map[color] || map['primary'];
  };

  return (
    <section className="space-y-4">
      {/* Primary Actions — 2x2 Grid */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">Study Tools</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {primaryActions.map((action) => {
            const colors = getColorClasses(action.color);
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`rounded-2xl border ${colors.border} p-3.5 text-left transition-all active:scale-[0.97]`}
              >
                <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`h-4.5 w-4.5 ${colors.icon}`} />
                </div>
                <p className="font-medium text-sm text-foreground">{action.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{action.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Actions — Compact horizontal chips */}
      <div>
        <h2 className="font-display text-base font-semibold text-foreground mb-3">More</h2>
        <div className="flex flex-wrap gap-2">
          {secondaryActions.map((action) => {
            const colors = getColorClasses(action.color);
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`flex items-center gap-2 rounded-xl border ${colors.border} px-3 py-2 transition-all active:scale-[0.97]`}
              >
                <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${colors.icon}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-xs text-foreground leading-tight">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{action.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
