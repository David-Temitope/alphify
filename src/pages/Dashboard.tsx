import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKnowledgeUnits } from '@/hooks/useKnowledgeUnits';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquarePlus,
  BookOpen,
  ChevronRight,
  Sparkles,
  FileText,
  GraduationCap,
  Coins,
  Bell,
  Search,
  Clock,
  LogOut,
  Wand2,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import BottomNav from '@/components/BottomNav';
import { format } from 'date-fns';
import alphifyLogo from '@/assets/alphify-logo.webp';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, canChat } = useKnowledgeUnits();

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: files } = useQuery({
    queryKey: ['recent-files'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uploaded_files').select('*').order('created_at', { ascending: false }).limit(3);
      if (error) throw error;
      return data;
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_settings').select('courses, preferred_name, field_of_study, ai_personality').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const needsOnboarding = !userSettings || !userSettings.preferred_name || !userSettings.field_of_study || !userSettings.ai_personality?.length;

  const handleNewChat = async () => {
    if (!canChat) {
      toast({
        title: 'No Knowledge Units',
        description: 'You need at least 1 KU to chat with Ezra. Top up your wallet!',
        variant: 'destructive',
      });
      navigate('/settings?tab=wallet');
      return;
    }

    const { data, error } = await supabase.from('conversations').insert({
      user_id: user!.id,
      title: 'New Conversation',
    }).select().single();

    if (!error && data) {
      navigate(`/chat/${data.id}`);
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Student';
  const courses = userSettings?.courses || [];

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Good {getTimeOfDay()} 👋</p>
            <h1 className="font-display text-xl font-bold text-foreground">Hi, {firstName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings?tab=wallet')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              <Coins className="h-3.5 w-3.5" />
              {balance} KU
            </button>
            <ThemeToggle />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/');
              }}
              className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-6">
        {/* Onboarding Prompt */}
        {needsOnboarding && (
          <button
            onClick={() => navigate('/settings?tab=profile')}
            className="w-full rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/25 p-4 text-left transition-all hover:border-primary/40"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">Set up your preferences ✨</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tell Ezra about yourself to get personalized explanations, study tips, and more.</p>
                <span className="inline-block mt-2 text-xs font-medium text-primary">Set Up Now →</span>
              </div>
            </div>
          </button>
        )}
        {/* Low balance warning */}
        {balance <= 5 && balance > 0 && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-primary">
            ⚡ {balance} KU left.{' '}
            <button onClick={() => navigate('/settings?tab=wallet')} className="underline font-semibold">Top up</button>
          </div>
        )}
        {balance === 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            🔴 No KU left.{' '}
            <button onClick={() => navigate('/settings?tab=wallet')} className="underline font-semibold">Buy KU</button>
          </div>
        )}

        {/* Quick Actions - Horizontal scroll cards */}
        <section>
          <h2 className="font-display text-base font-semibold text-foreground mb-3">Quick Actions</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={handleNewChat}
              className="flex-shrink-0 w-36 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4 text-left hover:border-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                <MessageSquarePlus className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-sm text-foreground">Ask Ezra</p>
              <p className="text-xs text-muted-foreground mt-0.5">Start chat</p>
            </button>

            <button
              onClick={() => navigate('/exam')}
              className="flex-shrink-0 w-36 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 p-4 text-left hover:border-amber-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
                <GraduationCap className="h-5 w-5 text-amber-500" />
              </div>
              <p className="font-medium text-sm text-foreground">Exam Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Practice tests</p>
            </button>

            <button
              onClick={() => navigate('/library')}
              className="flex-shrink-0 w-36 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 p-4 text-left hover:border-blue-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <p className="font-medium text-sm text-foreground">Library</p>
              <p className="text-xs text-muted-foreground mt-0.5">{files?.length ?? 0} docs</p>
            </button>

            <button
              onClick={async () => {
                if (balance < 2) {
                  toast({ title: 'Not enough KU', description: 'Assignment Assist costs 2 KU per prompt.', variant: 'destructive' });
                  navigate('/settings?tab=wallet');
                  return;
                }
                const { data, error } = await supabase.from('conversations').insert({ user_id: user!.id, title: 'Assignment Assist' }).select().single();
                if (!error && data) navigate(`/chat/${data.id}?mode=assignment`);
              }}
              className="flex-shrink-0 w-36 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 p-4 text-left hover:border-emerald-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="font-medium text-sm text-foreground">Assignment</p>
              <p className="text-xs text-muted-foreground mt-0.5">2 KU/prompt</p>
            </button>

            <button
              onClick={() => navigate('/community')}
              className="flex-shrink-0 w-36 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 p-4 text-left hover:border-violet-500/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-violet-500" />
              </div>
              <p className="font-medium text-sm text-foreground">Community</p>
              <p className="text-xs text-muted-foreground mt-0.5">Study mates</p>
            </button>
          </div>
        </section>

        {/* Courses section */}
        {courses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-foreground">Your Courses</h2>
              <span className="text-xs text-muted-foreground">{courses.length} courses</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {courses.slice(0, 6).map((course: string) => (
                <span
                  key={course}
                  className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-foreground border border-border"
                >
                  {course}
                </span>
              ))}
              {courses.length > 6 && (
                <span className="px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                  +{courses.length - 6} more
                </span>
              )}
            </div>
          </section>
        )}

        {/* Recent Conversations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Chats
            </h2>
          </div>

          {conversations && conversations.length > 0 ? (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">{conv.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {conv.subject || 'General'} · {format(new Date(conv.updated_at), 'MMM d')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border p-8 text-center">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-display font-semibold text-base mb-1">No conversations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Ask Ezra anything to get started</p>
              <Button onClick={handleNewChat} size="sm" className="bg-primary text-primary-foreground">
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Start Learning
              </Button>
            </div>
          )}
        </section>

        {/* Recent Files */}
        {files && files.length > 0 && (
          <section>
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              Recent Uploads
            </h2>
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">{file.file_name}</h4>
                    <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
