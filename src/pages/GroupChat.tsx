import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Send, Users, Loader2, Play, Crown, Plus, UserPlus, X
} from 'lucide-react';
import CreateSessionModal from '@/components/CreateSessionModal';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface ProfileMap {
  [userId: string]: string | null;
}

export default function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch group details
  const { data: group, isLoading } = useQuery({
    queryKey: ['study-group', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_groups')
        .select('*')
        .eq('id', groupId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId
  });

  const isAdmin = user?.id === group?.admin_id;
  const isSuspended = group?.suspended_until && new Date(group.suspended_until) > new Date();

  // Fetch members
  const { data: members } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_group_members')
        .select('id, user_id')
        .eq('group_id', groupId);
      return data || [];
    },
    enabled: !!groupId
  });

  // Fetch active session
  const { data: activeSession } = useQuery({
    queryKey: ['active-session', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('group_id', groupId!)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!groupId
  });

  // Fetch messages
  const { data: groupMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId!)
        .order('created_at', { ascending: true });
      return (data || []) as GroupMessage[];
    },
    enabled: !!groupId
  });

  // Collect user IDs for profile lookup
  const memberUserIds = members?.map(m => m.user_id) || [];
  const messageUserIds = groupMessages?.map(m => m.user_id) || [];
  const allUserIds = [...new Set([...memberUserIds, ...messageUserIds, group?.admin_id].filter(Boolean))] as string[];

  const { data: profiles } = useQuery({
    queryKey: ['group-profiles', allUserIds.join(',')],
    queryFn: async () => {
      if (allUserIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);
      const map: ProfileMap = {};
      data?.forEach(p => { map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: allUserIds.length > 0
  });

  // Search users to invite (study mates not already in group)
  const { data: inviteCandidates } = useQuery({
    queryKey: ['invite-candidates', groupId, inviteSearch],
    queryFn: async () => {
      if (!inviteSearch.trim()) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .ilike('full_name', `%${inviteSearch}%`)
        .not('user_id', 'in', `(${[...memberUserIds, group?.admin_id].join(',')})`)
        .limit(10);
      return data || [];
    },
    enabled: !!groupId && showAddMember && inviteSearch.length > 1
  });

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`
      }, () => { refetchMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, refetchMessages]);

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  // Send message
  const sendMsg = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('group_messages').insert({
        group_id: groupId!,
        user_id: user!.id,
        content
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      refetchMessages();
    },
    onError: (err) => {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send', variant: 'destructive' });
    }
  });

  // Add member
  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('study_group_members').insert({
        group_id: groupId!, user_id: userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      toast({ title: 'Member added!' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  });

  const handleSend = () => {
    if (!message.trim() || sendMsg.isPending) return;
    sendMsg.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-foreground">Group not found</p>
        <Button variant="outline" onClick={() => navigate('/community')}>Go to Community</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/community')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground flex items-center gap-2">
                {group.name}
                {isAdmin && <Crown className="h-4 w-4 text-primary" />}
              </h1>
              <p className="text-xs text-muted-foreground">
                {members?.length ? `${members.length + 1} members` : '1 member'}
                {group.field_of_study && ` · ${group.field_of_study}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setShowAddMember(true)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{(members?.length || 0) + 1}</span>
            </div>
          </div>
        </div>

        {/* Active session banner */}
        {activeSession && (
          <div className="bg-primary/10 border-t border-primary/20 px-4 py-2">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-primary font-medium">Live: {activeSession.topic}</span>
              </div>
              <Button size="sm" onClick={() => navigate(`/session/${activeSession.id}`)}>
                <Play className="h-3 w-3 mr-1" /> Join Session
              </Button>
            </div>
          </div>
        )}

        {/* Admin: Create Session */}
        {isAdmin && !isSuspended && !activeSession && (
          <div className="border-t border-border px-4 py-2">
            <div className="max-w-5xl mx-auto">
              <Button variant="outline" size="sm" onClick={() => setShowCreateSession(true)}>
                <Plus className="h-3 w-3 mr-1" /> Create Study Session
              </Button>
            </div>
          </div>
        )}
      </header>

      {isSuspended && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 text-center">
          Group suspended until {new Date(group.suspended_until!).toLocaleDateString()}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-5xl mx-auto w-full">
        {(!groupMessages || groupMessages.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Welcome to {group.name}!</p>
            <p className="text-sm mt-1">Start chatting with your group members.</p>
          </div>
        )}

        {groupMessages?.map((msg) => {
          const isMe = msg.user_id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : ''}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium shrink-0">
                  {(profiles?.[msg.user_id] || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[75%] rounded-xl px-4 py-2 ${
                isMe ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
              }`}>
                {!isMe && (
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {profiles?.[msg.user_id] || 'Member'}
                    {msg.user_id === group.admin_id && ' 👑'}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="max-w-5xl mx-auto flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-32 resize-none bg-secondary border-border"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMsg.isPending}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create Session Modal */}
      <CreateSessionModal
        open={showCreateSession}
        onOpenChange={setShowCreateSession}
        groupId={group.id}
        groupName={group.name}
      />

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members</DialogTitle>
            <DialogDescription>Search and add members to your group.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search by name..."
            value={inviteSearch}
            onChange={(e) => setInviteSearch(e.target.value)}
          />
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {inviteCandidates?.map((c) => (
                <div key={c.user_id} className="flex items-center justify-between p-2 rounded-lg bg-secondary">
                  <span className="text-sm">{c.full_name || 'Student'}</span>
                  <Button size="sm" variant="outline" onClick={() => addMember.mutate(c.user_id)}
                    disabled={addMember.isPending}>
                    <UserPlus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
              {inviteSearch.length > 1 && (!inviteCandidates || inviteCandidates.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
