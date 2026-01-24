import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Send, Users, Clock, Loader2, 
  BookOpen, AlertTriangle, CheckCircle
} from 'lucide-react';

interface SessionMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  is_ai_message: boolean;
  created_at: string;
}

interface Participant {
  id: string;
  user_id: string;
  is_active: boolean;
}

interface ProfileMap {
  [userId: string]: string | null;
}

export default function StudySession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Fetch session details
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['study-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*, study_groups(name)')
        .eq('id', sessionId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId
  });

  // Fetch participants
  const { data: participants } = useQuery({
    queryKey: ['session-participants', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_participants')
        .select('id, session_id, user_id, is_active')
        .eq('session_id', sessionId)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!sessionId
  });

  // Fetch messages
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['session-messages', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('session_messages')
        .select('id, session_id, user_id, content, is_ai_message, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      return (data || []) as SessionMessage[];
    },
    enabled: !!sessionId
  });

  // Fetch profiles for participants and message authors
  const userIds = [
    ...(participants?.map(p => p.user_id) || []),
    ...(messages?.filter(m => !m.is_ai_message).map(m => m.user_id) || [])
  ].filter((id, index, self) => self.indexOf(id) === index);

  const { data: profiles } = useQuery({
    queryKey: ['session-profiles', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap: ProfileMap = {};
      data?.forEach(p => {
        profileMap[p.user_id] = p.full_name;
      });
      return profileMap;
    },
    enabled: userIds.length > 0
  });

  // Join session on mount
  useEffect(() => {
    if (!user || !sessionId) return;

    const joinSession = async () => {
      const { error } = await supabase
        .from('session_participants')
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          is_active: true
        }, { onConflict: 'session_id,user_id' });
      
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['session-participants', sessionId] });
      }
    };

    joinSession();

    // Leave session on unmount
    return () => {
      supabase
        .from('session_participants')
        .update({ is_active: false })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);
    };
  }, [user, sessionId, queryClient]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_messages',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          refetchMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['session-participants', sessionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, refetchMessages, queryClient]);

  // Timer countdown
  useEffect(() => {
    if (!session?.ends_at) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(session.ends_at);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Session ended');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.ends_at]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !sessionId) throw new Error('Not ready');

      // Save user message
      const { error: msgError } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          content,
          is_ai_message: false
        });

      if (msgError) throw msgError;

      // Get AI response
      setIsStreaming(true);
      setStreamingContent('');

      const response = await supabase.functions.invoke('session-chat', {
        body: {
          sessionId,
          message: content,
          topic: session?.topic,
          course: session?.course
        }
      });

      if (response.error) throw response.error;

      // Save AI response
      const { error: aiError } = await supabase
        .from('session_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          content: response.data.response,
          is_ai_message: true
        });

      if (aiError) throw aiError;

      return response.data;
    },
    onSuccess: () => {
      setMessage('');
      setIsStreaming(false);
      setStreamingContent('');
      refetchMessages();
    },
    onError: (error) => {
      setIsStreaming(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
    }
  });

  const handleSend = () => {
    if (!message.trim() || sendMessage.isPending) return;
    sendMessage.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-foreground">Session not found</p>
        <Button variant="outline" onClick={() => navigate('/community')}>
          Go to Community
        </Button>
      </div>
    );
  }

  const isSessionActive = session.status === 'active' && timeLeft !== 'Session ended';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/community')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {session.topic}
              </h1>
              <p className="text-sm text-muted-foreground">{session.course}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{participants?.length || 0}</span>
            </div>
            <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
              isSessionActive 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <Clock className="h-4 w-4" />
              <span>{timeLeft}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex max-w-5xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Welcome message */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  G
                </div>
                <span className="font-medium text-foreground">Gideon</span>
              </div>
              <p className="text-muted-foreground">
                Welcome to the study session on <strong>{session.topic}</strong>! 
                I'll be guiding you through this topic. Feel free to ask questions, 
                and I'll send quizzes periodically to check your understanding. Let's learn together! 📚
              </p>
            </div>

            {messages?.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-3 ${msg.is_ai_message ? '' : 'justify-end'}`}
              >
                {msg.is_ai_message && (
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    G
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl p-4 ${
                  msg.is_ai_message 
                    ? 'bg-card border border-border' 
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {!msg.is_ai_message && profiles?.[msg.user_id] && (
                    <p className="text-xs opacity-70 mb-1">{profiles[msg.user_id]}</p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {!msg.is_ai_message && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm shrink-0">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                  G
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {isSessionActive ? (
            <div className="border-t border-border p-4">
              <div className="flex gap-3">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question or discuss the topic..."
                  className="min-h-[60px] resize-none bg-secondary border-0"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMessage.isPending}
                  className="bg-primary text-primary-foreground self-end"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5" />
                <span>This session has ended</span>
              </div>
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        <div className="w-64 border-l border-border p-4 hidden lg:block">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({participants?.length || 0})
          </h3>
          <div className="space-y-2">
            {participants?.map((p: Participant) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">
                  👤
                </div>
                <span className="text-sm text-foreground truncate">
                  {profiles?.[p.user_id] || 'Student'}
                </span>
                <span className="w-2 h-2 bg-primary rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
