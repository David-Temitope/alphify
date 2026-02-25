import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Loader2, ShieldAlert } from 'lucide-react';

const BLOCKED_PATTERNS = /(\b(sex|nude|naked|porn|xxx|dick|pussy|fuck|shit|ass\b|bitch|damn|bastard|cock|cunt|whore|slut)\b)/i;

export default function MateChat() {
  const { mateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const { data: mateProfile } = useQuery({
    queryKey: ['mate-profile', mateId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', mateId!).single();
      return data;
    },
    enabled: !!mateId,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['mate-messages', mateId],
    queryFn: async () => {
      if (!mateId || !user) return [];
      const { data, error } = await supabase
        .from('mate_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${mateId}),and(sender_id.eq.${mateId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!mateId && !!user,
    refetchInterval: 3000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!mateId || !user) return;
    const channel = supabase
      .channel(`mate-chat-${mateId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mate_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['mate-messages', mateId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mateId, user, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending || !user || !mateId) return;

    // Content moderation
    if (BLOCKED_PATTERNS.test(input)) {
      toast({ title: 'Message blocked', description: 'Please keep conversations educational and respectful.', variant: 'destructive' });
      return;
    }

    // Check if message is educational/check-in
    const msg = input.trim();
    setSending(true);
    try {
      const { error } = await supabase.from('mate_messages').insert({
        sender_id: user.id,
        receiver_id: mateId,
        content: msg,
      });
      if (error) throw error;
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['mate-messages', mateId] });
    } catch (error) {
      toast({ title: 'Failed to send', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const mateName = mateProfile?.full_name || 'Study Mate';

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/community')} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
          {mateName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-foreground truncate">{mateName}</h1>
          <p className="text-xs text-muted-foreground">Study Mate</p>
        </div>
      </header>

      {/* Moderation notice */}
      <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <p className="text-xs text-muted-foreground">Keep conversations educational and respectful. Messages are monitored.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No messages yet. Say hi to your study mate! 👋</p>
            <p className="text-xs text-muted-foreground mt-1">Keep it educational — check on each other's studies!</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border text-foreground rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-xl px-3 pb-3 pt-2 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message your study mate..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-secondary rounded-2xl border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50"
            rows={1}
          />
          <Button type="submit" disabled={!input.trim() || sending} size="icon" className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex-shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
