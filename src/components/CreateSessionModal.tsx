import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, BookOpen, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

export default function CreateSessionModal({ open, onOpenChange, groupId, groupName }: CreateSessionModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState('');
  const [course, setCourse] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Fetch user's courses
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('courses')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user
  });

  // Check if group already had 3 sessions today
  const { data: todaysSessions } = useQuery({
    queryKey: ['todays-sessions', groupId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('study_sessions')
        .select('id')
        .eq('group_id', groupId)
        .gte('created_at', today.toISOString());
      
      return data || [];
    },
    enabled: !!groupId
  });

  const sessionsCreatedCount = todaysSessions?.length || 0;
  const canCreateSession = sessionsCreatedCount < 3;
  const courses = userSettings?.courses || [];

  // Fetch group members to invite
  const { data: groupMembers } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_group_members')
        .select('user_id')
        .eq('group_id', groupId);
      return data || [];
    },
    enabled: !!groupId && open
  });

  const inviteableMembers = groupMembers?.filter(m => m.user_id !== user?.id) || [];

  // Fetch profiles for members
  const memberIds = inviteableMembers.map(m => m.user_id);
  const { data: memberProfiles } = useQuery({
    queryKey: ['member-profiles', memberIds.join(',')],
    queryFn: async () => {
      if (memberIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', memberIds);

      const profileMap: Record<string, string> = {};
      data?.forEach(p => {
        profileMap[p.user_id] = p.full_name || 'Student';
      });
      return profileMap;
    },
    enabled: memberIds.length > 0
  });

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createSession = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const now = new Date();
      const endsAt = new Date(now.getTime() + parseInt(duration) * 60000);
      
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          group_id: groupId,
          created_by: user.id,
          course,
          topic,
          duration_minutes: parseInt(duration),
          status: 'active',
          started_at: now.toISOString(),
          ends_at: endsAt.toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Auto-join the creator and invited members
      const participants = [
        { session_id: data.id, user_id: user.id, is_active: true },
        ...selectedMembers.map(userId => ({
          session_id: data.id,
          user_id: userId,
          is_active: false // Invited members start as inactive until they join
        }))
      ];

      await supabase
        .from('session_participants')
        .insert(participants);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['todays-sessions'] });
      toast({
        title: "Session Created!",
        description: `Your study session on "${topic}" has started.`
      });
      onOpenChange(false);
      setTopic('');
      setCourse('');
      setSelectedMembers([]);
      // Navigate to session
      window.location.href = `/session/${data.id}`;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create session",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !topic) {
      toast({
        title: "Missing Information",
        description: "Please select a course and enter a topic",
        variant: "destructive"
      });
      return;
    }

    const durNum = parseInt(duration);
    if (durNum <= 10) {
      toast({
        title: "Duration Too Short",
        description: "Session duration must be above 10 minutes",
        variant: "destructive"
      });
      return;
    }
    if (durNum > 60) {
      toast({
        title: "Duration Too Long",
        description: "Session duration cannot exceed 60 minutes",
        variant: "destructive"
      });
      return;
    }

    createSession.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Create Study Session
          </DialogTitle>
          <DialogDescription>
            Start a new study session for {groupName}
          </DialogDescription>
        </DialogHeader>

        {!canCreateSession ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-muted-foreground">
              This group has already reached the limit of 3 sessions today. You can create more tomorrow!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-primary/5 rounded-lg p-3 text-sm text-primary flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              <span>{3 - sessionsCreatedCount} sessions remaining for this group today</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              {courses.length > 0 ? (
                <Select value={course} onValueChange={setCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c: string) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-secondary rounded-lg">
                  No courses added. Go to Settings to add your courses first.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Quadratic Equations"
                disabled={courses.length === 0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes (max)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inviteableMembers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invite Members
                </Label>
                <ScrollArea className="h-[120px] border border-border rounded-lg p-2">
                  <div className="space-y-2">
                    {inviteableMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                        onClick={() => toggleMember(member.user_id)}
                      >
                        <Checkbox
                          checked={selectedMembers.includes(member.user_id)}
                          onCheckedChange={() => toggleMember(member.user_id)}
                        />
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs">
                          {(memberProfiles?.[member.user_id] || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground">
                          {memberProfiles?.[member.user_id] || 'Student'}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSession.isPending || courses.length === 0}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Session'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
