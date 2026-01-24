import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageSquarePlus, 
  BookOpen, 
  Clock, 
  LogOut, 
  ChevronRight,
  Sparkles,
  FileText,
  Settings,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: files } = useQuery({
    queryKey: ['recent-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const handleNewChat = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user!.id, title: 'New Conversation' })
      .select()
      .single();
    
    if (!error && data) {
      navigate(`/chat/${data.id}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Student';

  return (
    <div className="min-h-screen xp-bg-gradient">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between p-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center font-display font-bold text-lg text-primary-foreground shadow-lg shadow-primary/25">
              G
            </div>
            <span className="font-display font-semibold text-xl text-foreground hidden sm:block">Gideon</span>
          </div>

          <nav className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/library')}
              className="text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Library
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/community')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Users className="h-4 w-4 mr-2" />
              Community
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/settings')}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Section */}
        <div className="animate-fade-in-up">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            Good {getTimeOfDay()}, {firstName}! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Ready to understand something new today?
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <button 
            onClick={handleNewChat}
            className="glass-card p-6 rounded-2xl flex items-center gap-4 hover:border-primary/30 transition-all group text-left"
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-all">
              <MessageSquarePlus className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">Start New Chat</h3>
              <p className="text-muted-foreground text-sm">Ask anything - I'll explain it simply</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </button>

          <button 
            onClick={() => navigate('/library')}
            className="glass-card p-6 rounded-2xl flex items-center gap-4 hover:border-primary/30 transition-all group text-left"
          >
            <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-foreground">My Library</h3>
              <p className="text-muted-foreground text-sm">
                {files?.length ?? 0} documents uploaded
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </button>
        </div>

        {/* Recent Conversations */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Conversations
            </h2>
          </div>

          {conversations && conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="w-full glass-card p-4 rounded-xl flex items-center gap-4 hover:border-primary/30 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{conv.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {conv.subject || 'General learning'} • {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 rounded-2xl text-center">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="font-display font-semibold text-lg mb-2">No conversations yet</h3>
              <p className="text-muted-foreground mb-4">Start your first chat and let me help you understand anything!</p>
              <Button onClick={handleNewChat} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Start Learning
              </Button>
            </div>
          )}
        </div>

        {/* Recent Files */}
        {files && files.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              Recent Uploads
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <div key={file.id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate text-sm">{file.file_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(file.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
