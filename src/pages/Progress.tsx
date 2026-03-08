import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import BottomNav from '@/components/BottomNav';
import { 
  Flame, Trophy, BookOpen, Target, TrendingUp, 
  Calendar, Star, ArrowLeft, Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Progress() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch user settings (star rating, quizzes, scores)
  const { data: settings } = useQuery({
    queryKey: ['progress-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('star_rating, total_quizzes_taken, quiz_score_percentage, courses, preferred_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch exam attempts for score chart
  const { data: examAttempts } = useQuery({
    queryKey: ['progress-exams', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('exam_attempts')
        .select('score, max_score, course, completed_at, exam_type')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch conversations for study streak & topics
  const { data: conversations } = useQuery({
    queryKey: ['progress-conversations', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('created_at, subject, updated_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch usage tracking for activity heatmap
  const { data: usageData } = useQuery({
    queryKey: ['progress-usage', user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      const { data } = await supabase
        .from('usage_tracking')
        .select('date, chats_started')
        .eq('user_id', user!.id)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate study streak
  const calculateStreak = () => {
    if (!usageData || usageData.length === 0) return 0;
    const activeDates = new Set(usageData.filter(u => u.chats_started > 0).map(u => u.date));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
      if (activeDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  // Unique topics studied
  const topicsStudied = conversations
    ? [...new Set(conversations.filter(c => c.subject).map(c => c.subject!))]
    : [];

  // Chart data for exam scores
  const examChartData = (examAttempts || []).map((exam) => ({
    date: exam.completed_at ? format(parseISO(exam.completed_at), 'MMM d') : '',
    score: exam.score && exam.max_score ? Math.round((exam.score / exam.max_score) * 100) : 0,
    course: exam.course,
  }));

  // Activity chart data (last 14 days)
  const activityChartData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const usage = usageData?.find(u => u.date === dateStr);
    return {
      day: format(date, 'EEE'),
      chats: usage?.chats_started || 0,
    };
  });

  const streak = calculateStreak();
  const starRating = settings?.star_rating || 0;
  const totalQuizzes = settings?.total_quizzes_taken || 0;
  const avgScore = settings?.quiz_score_percentage || 0;
  const totalExams = examAttempts?.length || 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">My Progress</h1>
            <p className="text-xs text-muted-foreground">Track your learning journey</p>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-5">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Flame className="h-5 w-5 text-orange-500" />}
            label="Study Streak"
            value={`${streak} day${streak !== 1 ? 's' : ''}`}
            bg="from-orange-500/20 to-orange-500/5"
            border="border-orange-500/20"
          />
          <StatCard
            icon={<Star className="h-5 w-5 text-yellow-500" />}
            label="Star Rating"
            value={`${Number(starRating).toFixed(1)} / 5.0`}
            bg="from-yellow-500/20 to-yellow-500/5"
            border="border-yellow-500/20"
          />
          <StatCard
            icon={<Brain className="h-5 w-5 text-purple-500" />}
            label="Topics Explored"
            value={`${topicsStudied.length}`}
            bg="from-purple-500/20 to-purple-500/5"
            border="border-purple-500/20"
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-emerald-500" />}
            label="Exams Taken"
            value={`${totalExams}`}
            bg="from-emerald-500/20 to-emerald-500/5"
            border="border-emerald-500/20"
          />
        </div>

        {/* Quiz Performance */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Quiz Performance
            </h3>
            <span className="text-xs text-muted-foreground">{totalQuizzes} quizzes</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{avgScore}%</p>
          <p className="text-xs text-muted-foreground mb-3">Average score</p>

          {/* Score progress bar */}
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700"
              style={{ 
                width: `${Math.min(avgScore, 100)}%`,
                background: avgScore >= 70 
                  ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(142 76% 36%))' 
                  : avgScore >= 50 
                  ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(45 93% 47%))' 
                  : 'linear-gradient(90deg, hsl(0 84% 60%), hsl(var(--primary)))'
              }}
            />
          </div>
        </div>

        {/* Exam Score Trend */}
        {examChartData.length > 1 && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              Exam Score Trend
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={examChartData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip 
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                  <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#scoreGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Study Activity (Last 14 Days) */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-primary" />
            Study Activity (Last 14 Days)
          </h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityChartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value}`, 'Chats']}
                />
                <Bar dataKey="chats" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Topics Explored */}
        {topicsStudied.length > 0 && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              Topics Explored
            </h3>
            <div className="flex flex-wrap gap-2">
              {topicsStudied.slice(0, 12).map((topic) => (
                <span key={topic} className="px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary border border-primary/20">
                  {topic}
                </span>
              ))}
              {topicsStudied.length > 12 && (
                <span className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                  +{topicsStudied.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Motivational card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5 text-center">
          <p className="text-2xl mb-2">🚀</p>
          <h3 className="font-display font-bold text-foreground">
            {streak >= 7 ? "You're on fire!" : streak >= 3 ? "Great momentum!" : "Keep pushing!"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {streak >= 7
              ? `${streak}-day streak! Consistency is the key to mastery.`
              : streak >= 3
              ? `${streak} days in a row. You're building a solid habit!`
              : "Start a study streak today. Even 10 minutes counts!"}
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function StatCard({ icon, label, value, bg, border }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${bg} ${border} border p-4`}>
      <div className="mb-2">{icon}</div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
