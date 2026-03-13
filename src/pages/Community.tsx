import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Users,
  UserPlus,
  UserMinus,
  Check,
  X,
  Clock,
  GraduationCap,
  Loader2,
  Plus,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import StudyGroupCard from '@/components/StudyGroupCard';
import CreateGroupModal from '@/components/CreateGroupModal';
import BottomNav from '@/components/BottomNav';
import StarRating from '@/components/StarRating';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { sendPushNotification } from '@/lib/firebase';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface StudyRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
}

interface StudyMate {
  id: string;
  user_id: string;
  mate_id: string;
  created_at: string;
}

interface StudyGroup {
  id: string;
  name: string;
  admin_id: string;
  field_of_study: string | null;
  created_at: string;
  suspended_until: string | null;
  warning_count: number | null;
}

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'requests' | 'mates' | 'groups'>('discover');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const { unreadCount, markAsRead } = useUnreadMessages();

  const { data: myGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-study-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: adminGroups } = await supabase.from('study_groups').select('*').eq('admin_id', user.id);
      const { data: membershipData } = await supabase.from('study_group_members').select('group_id').eq('user_id', user.id);
      const memberGroupIds = membershipData?.map(m => m.group_id) || [];
      let memberGroups: StudyGroup[] = [];
      if (memberGroupIds.length > 0) {
        const { data } = await supabase.from('study_groups').select('*').in('id', memberGroupIds);
        memberGroups = (data || []) as StudyGroup[];
      }
      const allGroups = [...(adminGroups || []), ...memberGroups];
      return allGroups.filter((g, i, s) => i === s.findIndex(x => x.id === g.id)) as StudyGroup[];
    },
    enabled: !!user,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['community-users', searchQuery],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').neq('user_id', user!.id);
      if (searchQuery) query = query.ilike('full_name', `%${searchQuery}%`);
      const { data: profiles, error } = await query;
      if (error) throw error;
      const { data: publicSettings } = await supabase.rpc('get_public_profiles');
      return profiles?.map(profile => ({
        ...profile,
        settings: publicSettings?.find((s: any) => s.user_id === profile.user_id),
      }));
    },
  });

  const { data: requests } = useQuery({
    queryKey: ['study-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('study_requests').select('*').or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`);
      if (error) throw error;
      return data as StudyRequest[];
    },
  });

  const { data: studyMates } = useQuery({
    queryKey: ['study-mates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('study_mates').select('*').or(`user_id.eq.${user!.id},mate_id.eq.${user!.id}`);
      if (error) throw error;
      return data as StudyMate[];
    },
  });

  const sendRequest = useMutation({
    mutationFn: async (toUserId: string) => {
      const existing = requests?.find(
        r => (r.from_user_id === user!.id && r.to_user_id === toUserId) || (r.from_user_id === toUserId && r.to_user_id === user!.id)
      );
      if (existing) throw new Error('Request already exists');
      const { error } = await supabase.from('study_requests').insert({ from_user_id: user!.id, to_user_id: toUserId });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['study-requests'] }); toast({ title: 'Request sent!' }); },
    onError: (e) => { toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' }); },
  });

  const acceptRequest = useMutation({
    mutationFn: async (request: StudyRequest) => {
      await supabase.from('study_requests').update({ status: 'accepted' }).eq('id', request.id);
      const { error: m1 } = await supabase.from('study_mates').insert({ user_id: request.from_user_id, mate_id: request.to_user_id });
      if (m1 && !m1.message.includes('duplicate')) throw m1;
      const { error: m2 } = await supabase.from('study_mates').insert({ user_id: request.to_user_id, mate_id: request.from_user_id });
      if (m2 && !m2.message.includes('duplicate')) throw m2;
      await supabase.from('study_requests').delete().eq('id', request.id);

      // Notify the requester that their request was accepted
      const { data: accepterSettings } = await supabase
        .from('user_settings')
        .select('preferred_name')
        .eq('user_id', request.to_user_id)
        .single();
      const accepterName = accepterSettings?.preferred_name || 'Someone';
      sendPushNotification(
        request.from_user_id,
        'Study Mate Request Accepted! 🎉',
        `${accepterName} accepted your study mate request. Start chatting now!`,
        { link: `https://alphify.site/mate-chat/${request.to_user_id}`, type: 'friend_accepted' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-requests'] });
      queryClient.invalidateQueries({ queryKey: ['study-mates'] });
      queryClient.invalidateQueries({ queryKey: ['community-users'] });
      toast({ title: 'Accepted!', description: 'You are now study mates.' });
      setActiveTab('mates');
    },
    onError: (e) => { toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' }); },
  });

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.from('study_requests').delete().eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['study-requests'] }); toast({ title: 'Declined' }); },
  });

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.from('study_requests').delete().eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['study-requests'] }); toast({ title: 'Request cancelled' }); },
  });

  const unfriendMate = useMutation({
    mutationFn: async (mateUserId: string) => {
      await supabase.from('study_mates').delete().or(`and(user_id.eq.${user!.id},mate_id.eq.${mateUserId}),and(user_id.eq.${mateUserId},mate_id.eq.${user!.id})`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-mates'] });
      queryClient.invalidateQueries({ queryKey: ['community-users'] });
      toast({ title: 'Study mate removed' });
    },
  });

  const incomingRequests = requests?.filter(r => r.to_user_id === user!.id && r.status === 'pending') || [];
  const outgoingRequests = requests?.filter(r => r.from_user_id === user!.id && r.status === 'pending') || [];
  const mateIds = studyMates?.map(m => m.user_id === user!.id ? m.mate_id : m.user_id) || [];

  const getName = (p: { full_name: string | null }) => p.full_name || 'Student';

  const tabs = [
    { id: 'discover' as const, label: 'People', icon: Search },
    { id: 'requests' as const, label: 'Requests', icon: Clock, badge: incomingRequests.length },
    { id: 'mates' as const, label: 'Mates', icon: Users, count: mateIds.length, unread: unreadCount },
    { id: 'groups' as const, label: 'Groups', icon: GraduationCap },
  ];

  const renderUserCard = (profile: any, action: React.ReactNode) => (
    <div key={profile.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
      <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
        {getName(profile).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-foreground truncate">{getName(profile)}</h4>
        {profile.settings?.field_of_study && (
          <p className="text-xs text-muted-foreground truncate">{profile.settings.field_of_study}</p>
        )}
        <StarRating rating={profile.settings?.star_rating ?? 0} />
      </div>
      {action}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-foreground">Community</h1>
          <a
            href="https://chat.whatsapp.com/Gy40EBShSQY4YgmQ5gGWMY?mode=gi_t"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
          >
            💬 WhatsApp Group
          </a>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'mates') markAsRead();
              }}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs min-w-[18px] text-center">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.count > 0 && <span className="text-xs opacity-70">({tab.count})</span>}
              {'unread' in tab && (tab as any).unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        {/* DISCOVER */}
        {activeTab === 'discover' && (
          <div className="space-y-4">
            {/* Recommended Mates Section */}
            <RecommendedMates 
              userId={user!.id} 
              mateIds={mateIds}
              outgoingRequests={outgoingRequests}
              incomingRequests={incomingRequests}
              onSendRequest={(id) => sendRequest.mutate(id)}
              sendingRequest={sendRequest.isPending}
              renderUserCard={renderUserCard}
            />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search people..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-card border-border rounded-xl" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All People</h3>
            {usersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : users && users.filter(p => !mateIds.includes(p.user_id)).length > 0 ? (
              <div className="space-y-2">
                {users.filter(p => !mateIds.includes(p.user_id)).map((profile) => {
                  const isPendingOut = outgoingRequests.some(r => r.to_user_id === profile.user_id);
                  const isPendingIn = incomingRequests.some(r => r.from_user_id === profile.user_id);
                  const action = isPendingOut ? (
                    <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-secondary">Sent</span>
                  ) : isPendingIn ? (
                    <span className="text-xs text-primary px-3 py-1.5 rounded-full bg-primary/10">Respond</span>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-3 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => sendRequest.mutate(profile.user_id)} disabled={sendRequest.isPending}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  );
                  return renderUserCard(profile, action);
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border p-10 text-center">
                <Users className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">No people found</h3>
                <p className="text-sm text-muted-foreground">{searchQuery ? 'Try a different name' : 'Be the first to invite friends!'}</p>
              </div>
            )}
          </div>
        )}

        {/* REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Friend Requests</h3>
                <div className="space-y-2">
                  {incomingRequests.map((req) => {
                    const sender = users?.find(u => u.user_id === req.from_user_id);
                    return (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                          {sender ? getName(sender).charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-foreground">{sender ? getName(sender) : 'Unknown'}</h4>
                          <p className="text-xs text-muted-foreground">Wants to be your study mate</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground" onClick={() => rejectRequest.mutate(req.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button size="icon" className="h-8 w-8 rounded-full bg-primary text-primary-foreground" onClick={() => acceptRequest.mutate(req)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sent Requests</h3>
                <div className="space-y-2">
                  {outgoingRequests.map((req) => {
                    const receiver = users?.find(u => u.user_id === req.to_user_id);
                    return (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold text-lg flex-shrink-0">
                          {receiver ? getName(receiver).charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-foreground">{receiver ? getName(receiver) : 'Unknown'}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</p>
                        </div>
                        <Button size="sm" variant="outline" className="rounded-full h-8 px-3 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => cancelRequest.mutate(req.id)} disabled={cancelRequest.isPending}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="rounded-2xl bg-card border border-border p-10 text-center">
                <UserPlus className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">No pending requests</h3>
                <p className="text-sm text-muted-foreground">Go to People tab to connect!</p>
              </div>
            )}
          </div>
        )}

        {/* MATES */}
        {activeTab === 'mates' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Study Mates</h3>
            {mateIds.length > 0 ? (
              <div className="space-y-2">
                {users?.filter(u => mateIds.includes(u.user_id)).map((profile) =>
                  renderUserCard(profile, (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-primary" onClick={() => navigate(`/mate-chat/${profile.user_id}`)}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={() => {
                        if (confirm('Remove this study mate?')) unfriendMate.mutate(profile.user_id);
                      }}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border p-10 text-center">
                <Users className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">No study mates yet</h3>
                <p className="text-sm text-muted-foreground">Send requests from the People tab!</p>
              </div>
            )}
          </div>
        )}

        {/* GROUPS */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Groups</h3>
              <Button size="sm" onClick={() => setShowCreateGroupModal(true)} className="rounded-full bg-primary text-primary-foreground">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create
              </Button>
            </div>
            {groupsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : myGroups && myGroups.length > 0 ? (
              <div className="space-y-3">
                {myGroups.map((group) => (
                  <StudyGroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border p-10 text-center">
                <GraduationCap className="h-12 w-12 text-primary mx-auto mb-3" />
                <h3 className="font-display font-semibold mb-1">No groups yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create a group to study with friends!</p>
                <Button onClick={() => setShowCreateGroupModal(true)} className="bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" /> Create Group
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <CreateGroupModal open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal} />
      <BottomNav />
    </div>
  );
}

// Recommended Mates component using the RPC function
function RecommendedMates({ 
  userId, mateIds, outgoingRequests, incomingRequests, onSendRequest, sendingRequest, renderUserCard 
}: {
  userId: string;
  mateIds: string[];
  outgoingRequests: StudyRequest[];
  incomingRequests: StudyRequest[];
  onSendRequest: (id: string) => void;
  sendingRequest: boolean;
  renderUserCard: (profile: any, action: React.ReactNode) => React.ReactNode;
}) {
  const { data: recommended, isLoading } = useQuery({
    queryKey: ['recommended-mates', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recommended_mates', { _user_id: userId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Get profiles for the recommended users
  const { data: profiles } = useQuery({
    queryKey: ['recommended-profiles', recommended?.map((r: any) => r.user_id)],
    queryFn: async () => {
      const userIds = recommended!.map((r: any) => r.user_id);
      const { data } = await supabase.from('profiles').select('*').in('user_id', userIds);
      return data || [];
    },
    enabled: !!recommended && recommended.length > 0,
  });

  const filteredRecs = recommended
    ?.filter((r: any) => !mateIds.includes(r.user_id))
    .slice(0, 5) || [];

  if (isLoading || filteredRecs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Recommended for you
      </h3>
      {filteredRecs.map((rec: any) => {
        const profile = profiles?.find((p: any) => p.user_id === rec.user_id);
        const displayProfile = {
          id: rec.user_id,
          user_id: rec.user_id,
          full_name: rec.preferred_name || profile?.full_name || 'Student',
          settings: { field_of_study: rec.field_of_study, star_rating: rec.star_rating },
        };
        const isPendingOut = outgoingRequests.some(r => r.to_user_id === rec.user_id);
        const isPendingIn = incomingRequests.some(r => r.from_user_id === rec.user_id);
        const action = isPendingOut ? (
          <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-secondary">Sent</span>
        ) : isPendingIn ? (
          <span className="text-xs text-primary px-3 py-1.5 rounded-full bg-primary/10">Respond</span>
        ) : (
          <Button size="sm" variant="outline" className="rounded-full h-8 px-3 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => onSendRequest(rec.user_id)} disabled={sendingRequest}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        );
        return renderUserCard(displayProfile, action);
      })}
    </div>
  );
}
