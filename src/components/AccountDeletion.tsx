import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, XCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AccountDeletion() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');

  // Fetch profile to check scheduled deletion
  const { data: profile, refetch } = useQuery({
    queryKey: ['profile-deletion', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('scheduled_deletion_at')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const scheduleDeletion = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'schedule' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to schedule deletion');
      }

      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Account scheduled for deletion',
        description: 'Your account will be permanently deleted in 7 days. You can cancel anytime before then.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to schedule deletion',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const cancelDeletion = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel deletion');
      }

      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Deletion cancelled',
        description: 'Your account will not be deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to cancel deletion',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const isScheduled = profile?.scheduled_deletion_at && new Date(profile.scheduled_deletion_at) > new Date();
  const deletionDate = profile?.scheduled_deletion_at ? new Date(profile.scheduled_deletion_at) : null;

  if (isScheduled && deletionDate) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
        <div className="flex items-center gap-3 mb-3">
          <Clock className="h-5 w-5 text-destructive" />
          <span className="font-medium text-destructive">Account Deletion Scheduled</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your account will be permanently deleted on <strong>{format(deletionDate, 'MMMM d, yyyy')}</strong> ({formatDistanceToNow(deletionDate, { addSuffix: true })}).
        </p>
        <Button
          variant="outline"
          onClick={() => cancelDeletion.mutate()}
          disabled={cancelDeletion.isPending}
        >
          {cancelDeletion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Deletion
        </Button>
      </div>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Delete My Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action will schedule your account for permanent deletion. After 7 days, all your data will be permanently removed, including:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>All chat conversations</li>
              <li>Uploaded files and documents</li>
              <li>Study groups and sessions</li>
              <li>Subscription and payment history</li>
            </ul>
            <p className="font-medium">
              You can cancel this within 7 days by logging back in.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => scheduleDeletion.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={scheduleDeletion.isPending}
          >
            {scheduleDeletion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Yes, delete my account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
