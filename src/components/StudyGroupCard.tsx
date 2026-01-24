import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Play, Crown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CreateSessionModal from './CreateSessionModal';

interface StudyGroup {
  id: string;
  name: string;
  admin_id: string;
  field_of_study: string | null;
  created_at: string;
  suspended_until: string | null;
  warning_count: number | null;
}

interface StudyGroupCardProps {
  group: StudyGroup;
  onJoinSession?: (sessionId: string) => void;
}

export default function StudyGroupCard({ group, onJoinSession }: StudyGroupCardProps) {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isAdmin = user?.id === group.admin_id;
  const isSuspended = group.suspended_until && new Date(group.suspended_until) > new Date();

  // Fetch member count
  const { data: memberCount } = useQuery({
    queryKey: ['group-member-count', group.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('study_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);
      return (count || 0) + 1; // +1 for admin
    }
  });

  // Fetch active session
  const { data: activeSession, isLoading: loadingSession } = useQuery({
    queryKey: ['active-session', group.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('group_id', group.id)
        .eq('status', 'active')
        .single();
      return data;
    }
  });

  // Fetch admin profile
  const { data: adminProfile } = useQuery({
    queryKey: ['profile', group.admin_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', group.admin_id)
        .single();
      return data;
    }
  });

  const handleJoinSession = () => {
    if (activeSession && onJoinSession) {
      onJoinSession(activeSession.id);
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              {group.name}
              {isAdmin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Admin
                </span>
              )}
            </h3>
            {group.field_of_study && (
              <p className="text-sm text-muted-foreground mt-1">{group.field_of_study}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            <span>{memberCount}</span>
          </div>
        </div>

        {adminProfile && !isAdmin && (
          <p className="text-xs text-muted-foreground mb-4">
            Led by {adminProfile.full_name || 'Unknown'}
          </p>
        )}

        {isSuspended && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
            Group suspended until {new Date(group.suspended_until!).toLocaleDateString()}
          </div>
        )}

        {loadingSession ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeSession ? (
          <div className="space-y-3">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-primary text-sm font-medium mb-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Live Session
              </div>
              <p className="text-foreground font-medium">{activeSession.topic}</p>
              <p className="text-xs text-muted-foreground">{activeSession.course}</p>
            </div>
            <Button 
              onClick={handleJoinSession}
              className="w-full bg-primary text-primary-foreground"
            >
              <Play className="h-4 w-4 mr-2" />
              Join Session
            </Button>
          </div>
        ) : (
          <div>
            {isAdmin && !isSuspended ? (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-primary text-primary-foreground"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-2">
                No active session
              </p>
            )}
          </div>
        )}
      </div>

      <CreateSessionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        groupId={group.id}
        groupName={group.name}
      />
    </>
  );
}
