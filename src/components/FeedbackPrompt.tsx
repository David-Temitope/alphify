import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageCircleHeart, X, Star } from 'lucide-react';

export default function FeedbackPrompt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkFeedback = async () => {
      const dismissed = sessionStorage.getItem('feedback_dismissed');
      if (dismissed) return;

      const { data } = await supabase
        .from('user_settings')
        .select('feedback_submitted')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.feedback_submitted) return;

      // Show after 10 seconds
      const timer = setTimeout(() => setShowPrompt(true), 10000);
      return () => clearTimeout(timer);
    };
    checkFeedback();
  }, [user]);

  const dismiss = () => {
    setShowPrompt(false);
    setShowForm(false);
    sessionStorage.setItem('feedback_dismissed', 'true');
  };

  const submit = async () => {
    if (!feedback.trim() || !user) return;
    setSubmitting(true);
    try {
      await supabase.from('user_feedback').insert({
        user_id: user.id,
        feedback: feedback.trim(),
        rating,
      });
      await supabase.from('user_settings').update({ feedback_submitted: true }).eq('user_id', user.id);
      toast({ title: 'Thank you! 🎉', description: 'Your feedback helps us improve Alphify.' });
      dismiss();
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto animate-slide-up">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              {showForm ? 'Share your experience' : 'Quick feedback?'}
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={dismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!showForm ? (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Got 1 minute? Tell us how Alphify is helping your studies.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-primary text-primary-foreground text-xs" onClick={() => setShowForm(true)}>
                Sure!
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className="p-0.5">
                  <Star className={`h-5 w-5 ${s <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="How has Alphify helped you? Any issues?"
              className="bg-secondary border-border text-sm min-h-[80px]"
              maxLength={500}
            />
            <Button
              onClick={submit}
              disabled={!feedback.trim() || submitting}
              size="sm"
              className="w-full bg-primary text-primary-foreground text-xs"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
