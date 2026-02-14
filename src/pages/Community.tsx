import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Search, 
  Users, 
  Star,
  UserPlus,
  Check,
  X,
  Clock,
  GraduationCap,
  Loader2,
  Plus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudyGroupCard from '@/components/StudyGroupCard';
import CreateGroupModal from '@/components/CreateGroupModal';
import PremiumBadge from '@/components/PremiumBadge';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface UserSetting {
  user_id: string;
  field_of_study: string | null;
  star_rating: number | null;
  preferred_name: string | null;
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
  const [activeTab, setActiveTab] = useState('discover');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Fetch user's study groups (where they are admin or member)
  const { data: myGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-study-groups', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get groups where user is admin
      const { data: adminGroups } = await supabase
        .from('study_groups')
        .select('*')
        .eq('admin_id', user.id);
      
      // Get groups where user is a member
      const { data: membershipData } = await supabase
        .from('study_group_members')
        .select('group_id')
        .eq('user_id', user.id);
      
      const memberGroupIds = membershipData?.map(m => m.group_id) || [];
      
      let memberGroups: StudyGroup[] = [];
      if (memberGroupIds.length > 0) {
        const { data } = await supabase
          .from('study_groups')
          .select('*')
          .in('id', memberGroupIds);
        memberGroups = (data || []) as StudyGroup[];
      }
      
      // Combine and dedupe
      const allGroups = [...(adminGroups || []), ...memberGroups];
      const uniqueGroups = allGroups.filter((group, index, self) => 
        index === self.findIndex(g => g.id === group.id)
      );
      
      return uniqueGroups as StudyGroup[];
    },
    enabled: !!user
  });

  // Fetch all users with their profiles and public settings
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['community-users', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user!.id);
      
      if (searchQuery) {
        query = query.ilike('full_name', `%${searchQuery}%`);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      // Get public profile info (star_rating, field_of_study) from the security definer function
      const { data: publicSettings } = await supabase.rpc('get_public_profiles');

      // Combine profiles with public settings
      return profiles?.map(profile => ({
        ...profile,
        settings: publicSettings?.find((s: { user_id: string; field_of_study: string | null; star_rating: number | null }) => s.user_id === profile.user_id) as { user_id: string; field_of_study: string | null; star_rating: number | null } | undefined,
      }));
    },
  });

  // Fetch ALL requests (sent and received) - include all statuses to check for existing requests
  const { data: requests } = useQuery({
    queryKey: ['study-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_requests')
        .select('*')
        .or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`);
      if (error) throw error;
      return data as StudyRequest[];
    },
  });

  // Fetch study mates
  const { data: studyMates } = useQuery({
    queryKey: ['study-mates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_mates')
        .select('*')
        .or(`user_id.eq.${user!.id},mate_id.eq.${user!.id}`);
      if (error) throw error;
      return data as StudyMate[];
    },
  });


  // Send request mutation
  const sendRequest = useMutation({
    mutationFn: async (toUserId: string) => {
      // Check if a request already exists (in any direction)
      const existingRequest = requests?.find(
        r => (r.from_user_id === user!.id && r.to_user_id === toUserId) ||
             (r.from_user_id === toUserId && r.to_user_id === user!.id)
      );
      
      if (existingRequest) {
        throw new Error('A request already exists with this user');
      }
      
      const { error } = await supabase
        .from('study_requests')
        .insert({ from_user_id: user!.id, to_user_id: toUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-requests'] });
      toast({ title: 'Request sent!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send request',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    },
  });

  // Accept request mutation
  const acceptRequest = useMutation({
    mutationFn: async (request: StudyRequest) => {
      // Update request status first
      const { error: updateError } = await supabase
        .from('study_requests')
        .update({ status: 'accepted' })
        .eq('id', request.id);
      
      if (updateError) throw updateError;

      // Create study mate connections (both directions) - insert one by one to handle individually
      const { error: mate1Error } = await supabase.from('study_mates').insert({
        user_id: request.from_user_id,
        mate_id: request.to_user_id,
      });
      
      if (mate1Error && !mate1Error.message.includes('duplicate')) {
        console.error('Error creating first mate connection:', mate1Error);
        throw mate1Error;
      }

      const { error: mate2Error } = await supabase.from('study_mates').insert({
        user_id: request.to_user_id,
        mate_id: request.from_user_id,
      });
      
      if (mate2Error && !mate2Error.message.includes('duplicate')) {
        console.error('Error creating second mate connection:', mate2Error);
        throw mate2Error;
      }

      // Delete the request after successful acceptance to prevent "already exists" errors
      await supabase
        .from('study_requests')
        .delete()
        .eq('id', request.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-requests'] });
      queryClient.invalidateQueries({ queryKey: ['study-mates'] });
      queryClient.invalidateQueries({ queryKey: ['community-users'] });
      toast({ title: 'Request accepted!', description: 'You are now study mates.' });
      // Navigate to study mates tab
      setActiveTab('mates');
    },
    onError: (error) => {
      console.error('Accept request error:', error);
      toast({
        title: 'Failed to accept',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    },
  });

  // Reject request mutation - delete instead of update to avoid permission issues
  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('study_requests')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-requests'] });
      toast({ title: 'Request declined' });
    },
  });

  const incomingRequests = requests?.filter(r => r.to_user_id === user!.id && r.status === 'pending') || [];
  const outgoingRequests = requests?.filter(r => r.from_user_id === user!.id && r.status === 'pending') || [];
  const mateIds = studyMates?.map(m => m.user_id === user!.id ? m.mate_id : m.user_id) || [];

  const renderStars = (rating: number | null) => {
    const stars = Math.round(rating || 0);
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const getUserName = (profile: { full_name: string | null }) => {
    // Use full_name from profile (preferred_name is private and not exposed in public view)
    return profile.full_name || 'Student';
  };

  return (
    <div className="min-h-screen xp-bg-gradient">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="md:w-auto md:px-3">
              <ArrowLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Button>
            <div className="flex items-center gap-2 md:gap-3">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h1 className="font-display font-semibold text-lg md:text-xl text-foreground">Community</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="discover" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Discover</span>
              <Search className="h-4 w-4 sm:hidden" />
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Requests</span>
              <Clock className="h-4 w-4 sm:hidden" />
              {incomingRequests.length > 0 && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                  {incomingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mates" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Mates</span>
              <Users className="h-4 w-4 sm:hidden" />
              <span className="ml-1">({mateIds.length})</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Groups</span>
              <GraduationCap className="h-4 w-4 sm:hidden" />
            </TabsTrigger>
          </TabsList>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for study mates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>

            {/* Users Grid */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : users && users.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {users
                  .filter(profile => !mateIds.includes(profile.user_id)) // Hide study mates from discover
                  .map((profile) => {
                    const isPendingOutgoing = outgoingRequests.some(r => r.to_user_id === profile.user_id);
                    const isPendingIncoming = incomingRequests.some(r => r.from_user_id === profile.user_id);

                    return (
                      <div
                        key={profile.id}
                        className="glass-card p-4 rounded-xl animate-fade-in"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
                            {getUserName(profile).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground truncate">
                                {getUserName(profile)}
                              </h3>
                              
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {renderStars(profile.settings?.star_rating)}
                            </div>
                            {profile.settings?.field_of_study && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <GraduationCap className="h-3 w-3" />
                                <span className="truncate">{profile.settings.field_of_study}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          {isPendingOutgoing ? (
                            <Button variant="secondary" size="sm" className="w-full" disabled>
                              <Clock className="h-4 w-4 mr-2" />
                              Request Sent
                            </Button>
                          ) : isPendingIncoming ? (
                            <Button variant="secondary" size="sm" className="w-full" disabled>
                              <Clock className="h-4 w-4 mr-2" />
                              Pending Response
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full xp-gradient text-primary-foreground"
                              onClick={() => sendRequest.mutate(profile.user_id)}
                              disabled={sendRequest.isPending}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Send Request
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="glass-card p-12 rounded-2xl text-center">
                <Users className="h-16 w-16 text-primary mx-auto mb-6" />
                <h2 className="font-display text-xl font-semibold mb-2">No users found</h2>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'Be the first to invite your friends!'}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            {incomingRequests.length > 0 && (
              <div>
                <h2 className="font-display font-semibold text-lg mb-4">Incoming Requests</h2>
                <div className="space-y-3">
                  {incomingRequests.map((request) => {
                    const senderProfile = users?.find(u => u.user_id === request.from_user_id);
                    return (
                      <div key={request.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                            {senderProfile ? getUserName(senderProfile).charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {senderProfile ? getUserName(senderProfile) : 'Unknown User'}
                            </p>
                            <p className="text-sm text-muted-foreground">wants to be your study mate</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectRequest.mutate(request.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="xp-gradient text-primary-foreground"
                            onClick={() => acceptRequest.mutate(request)}
                          >
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
                <h2 className="font-display font-semibold text-lg mb-4">Sent Requests</h2>
                <div className="space-y-3">
                  {outgoingRequests.map((request) => {
                    const receiverProfile = users?.find(u => u.user_id === request.to_user_id);
                    return (
                      <div key={request.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-semibold">
                            {receiverProfile ? getUserName(receiverProfile).charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {receiverProfile ? getUserName(receiverProfile) : 'Unknown User'}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Pending response
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="glass-card p-12 rounded-2xl text-center">
                <UserPlus className="h-16 w-16 text-primary mx-auto mb-6" />
                <h2 className="font-display text-xl font-semibold mb-2">No pending requests</h2>
                <p className="text-muted-foreground">Start connecting with other students!</p>
              </div>
            )}
          </TabsContent>

          {/* Study Mates Tab */}
          <TabsContent value="mates" className="space-y-6">
            {mateIds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {users?.filter(u => mateIds.includes(u.user_id)).map((profile) => (
                  <div
                    key={profile.id}
                    className="glass-card p-4 rounded-xl animate-fade-in"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
                        {getUserName(profile).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {getUserName(profile)}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(profile.settings?.star_rating)}
                        </div>
                        {profile.settings?.field_of_study && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <GraduationCap className="h-3 w-3" />
                            <span className="truncate">{profile.settings.field_of_study}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 rounded-2xl text-center">
                <Users className="h-16 w-16 text-primary mx-auto mb-6" />
                <h2 className="font-display text-xl font-semibold mb-2">No study mates yet</h2>
                <p className="text-muted-foreground mb-6">Connect with other students to study together!</p>
                <Button onClick={() => {}} className="xp-gradient text-primary-foreground">
                  Find Study Mates
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Study Groups Tab */}
          <TabsContent value="groups" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-foreground">Your Study Groups</h2>
              <Button 
                onClick={() => setShowCreateGroupModal(true)}
                className="bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>

            {groupsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : myGroups && myGroups.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myGroups.map((group) => (
                  <StudyGroupCard 
                    key={group.id} 
                    group={group}
                    onJoinSession={(sessionId) => navigate(`/session/${sessionId}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 rounded-2xl text-center">
                <Users className="h-16 w-16 text-primary mx-auto mb-6" />
                <h2 className="font-display text-xl font-semibold mb-2">No study groups yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create a group to start collaborative study sessions with your mates!
                </p>
                <Button 
                  onClick={() => setShowCreateGroupModal(true)} 
                  className="bg-primary text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Group
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <CreateGroupModal 
          open={showCreateGroupModal} 
          onOpenChange={setShowCreateGroupModal} 
        />
      </main>
    </div>
  );
}
