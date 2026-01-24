import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, BookOpen } from 'lucide-react';

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

  // Check if user already created a session today
  const { data: todaysSessions } = useQuery({
    queryKey: ['todays-sessions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('study_sessions')
        .select('id')
        .eq('created_by', user.id)
        .gte('created_at', today.toISOString());
      
      return data || [];
    },
    enabled: !!user
  });

  const hasCreatedToday = (todaysSessions?.length || 0) > 0;
  const courses = userSettings?.courses || [];

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
      
      // Auto-join the creator as a participant
      await supabase
        .from('session_participants')
        .insert({
          session_id: data.id,
          user_id: user.id
        });
      
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

        {hasCreatedToday ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-muted-foreground">
              You've already created a session today. You can create another one tomorrow!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
