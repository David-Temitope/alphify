import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FIELDS_OF_STUDY = [
  'Computer Science',
  'Software Engineering',
  'Information Technology',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biomedical Engineering',
  'Mathematics',
  'Statistics',
  'Physics',
  'Chemistry',
  'Biology',
  'Biochemistry',
  'Medicine',
  'Nursing',
  'Pharmacy',
  'Dentistry',
  'Public Health',
  'Business Administration',
  'Accounting',
  'Finance',
  'Economics',
  'Marketing',
  'Management',
  'Psychology',
  'Sociology',
  'Political Science',
  'Law',
  'International Relations',
  'Communications',
  'Journalism',
  'Arts & Humanities',
  'History',
  'Philosophy',
  'Literature',
  'Architecture',
  'Graphic Design',
  'Music',
  'Theater Arts',
  'Education',
  'Agricultural Science',
  'Environmental Science',
  'Other'
];

interface StudyMate {
  id: string;
  user_id: string;
  mate_id: string;
}

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateGroupModal({ open, onOpenChange }: CreateGroupModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [customField, setCustomField] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Fetch study mates to add as group members
  const { data: studyMates } = useQuery({
    queryKey: ['study-mates-for-group'],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('study_mates')
        .select('*')
        .or(`user_id.eq.${user.id},mate_id.eq.${user.id}`);
      return (data || []) as StudyMate[];
    },
    enabled: !!user && open
  });

  // Get mate IDs (excluding current user)
  const mateIds = studyMates?.map(m => m.user_id === user?.id ? m.mate_id : m.user_id) || [];

  // Fetch profiles for study mates
  const { data: mateProfiles } = useQuery({
    queryKey: ['mate-profiles', mateIds.join(',')],
    queryFn: async () => {
      if (mateIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', mateIds);
      return data || [];
    },
    enabled: mateIds.length > 0
  });

  // Fetch preferred names for study mates
  const { data: mateSettings } = useQuery({
    queryKey: ['mate-settings', mateIds.join(',')],
    queryFn: async () => {
      if (mateIds.length === 0) return [];
      const { data } = await supabase
        .from('user_settings')
        .select('user_id, preferred_name')
        .in('user_id', mateIds);
      return data || [];
    },
    enabled: mateIds.length > 0
  });

  const getMateName = (userId: string) => {
    const setting = mateSettings?.find(s => s.user_id === userId);
    if (setting?.preferred_name) return setting.preferred_name;
    const profile = mateProfiles?.find(p => p.user_id === userId);
    return profile?.full_name || 'Student';
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const finalField = fieldOfStudy === 'Other' ? customField : fieldOfStudy;
      
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('study_groups')
        .insert({
          name,
          admin_id: user.id,
          field_of_study: finalField || null
        })
        .select()
        .single();
      
      if (groupError) throw groupError;

      // Add selected members to the group
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map(userId => ({
          group_id: group.id,
          user_id: userId
        }));

        const { error: membersError } = await supabase
          .from('study_group_members')
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      toast({
        title: "Group Created!",
        description: `"${name}" is ready with ${selectedMembers.length + 1} member${selectedMembers.length > 0 ? 's' : ''}.`
      });
      onOpenChange(false);
      setName('');
      setFieldOfStudy('');
      setCustomField('');
      setSelectedMembers([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a group name",
        variant: "destructive"
      });
      return;
    }
    if (fieldOfStudy === 'Other' && !customField.trim()) {
      toast({
        title: "Missing Field",
        description: "Please enter your field of study",
        variant: "destructive"
      });
      return;
    }
    if (selectedMembers.length === 0) {
      toast({
        title: "No Members Selected",
        description: "Please select at least one study mate to add to your group",
        variant: "destructive"
      });
      return;
    }
    createGroup.mutate();
  };

  const hasStudyMates = mateIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Create Study Group
          </DialogTitle>
          <DialogDescription>
            Create a group and add your study mates for collaborative sessions
          </DialogDescription>
        </DialogHeader>

        {!hasStudyMates ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-muted-foreground mb-2">
              You need study mates to create a group.
            </p>
            <p className="text-sm text-muted-foreground">
              Go to the Discover tab and connect with other students first!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CS101 Study Group"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field">Field of Study</Label>
              <Select value={fieldOfStudy} onValueChange={setFieldOfStudy}>
                <SelectTrigger id="field">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS_OF_STUDY.map((field) => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldOfStudy === 'Other' && (
                <Input
                  value={customField}
                  onChange={(e) => setCustomField(e.target.value)}
                  placeholder="Enter your field of study"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2 flex-1 min-h-0">
              <Label>Add Members <span className="text-muted-foreground">(select at least 1)</span></Label>
              <ScrollArea className="h-[150px] border border-border rounded-lg p-2">
                <div className="space-y-2">
                  {mateIds.map((mateId) => (
                    <div 
                      key={mateId} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer"
                      onClick={() => toggleMember(mateId)}
                    >
                      <Checkbox 
                        checked={selectedMembers.includes(mateId)}
                        onCheckedChange={() => toggleMember(mateId)}
                      />
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        {getMateName(mateId).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-foreground">{getMateName(mateId)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected (+ you as admin)
                </p>
              )}
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
                disabled={createGroup.isPending || selectedMembers.length === 0}
                className="flex-1 bg-primary text-primary-foreground"
              >
                {createGroup.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Group'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}