import { useSubscription, PLAN_DISPLAY_PRICES } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Zap } from 'lucide-react';

interface UsageLimitBannerProps {
  type: 'chat' | 'prompt';
  conversationId?: string;
}

export default function UsageLimitBanner({ type, conversationId }: UsageLimitBannerProps) {
  const { currentPlan, canStartNewChat, canSendPrompt, getChatsRemaining, getPromptsRemaining, limits } = useSubscription();
  const navigate = useNavigate();

  if (currentPlan === 'free') {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">No active subscription</p>
          <p className="text-xs text-muted-foreground">Subscribe to start using X-Plane</p>
        </div>
        <Button 
          size="sm" 
          onClick={() => navigate('/settings?tab=subscription')}
          className="xp-gradient text-primary-foreground"
        >
          <Zap className="h-4 w-4 mr-1" />
          Subscribe
        </Button>
      </div>
    );
  }

  if (type === 'chat' && !canStartNewChat()) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">Daily chat limit reached</p>
          <p className="text-xs text-muted-foreground">
            You've used all {limits.maxChatsPerDay} chat{limits.maxChatsPerDay > 1 ? 's' : ''} for today. Upgrade for more!
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => navigate('/settings?tab=subscription')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  if (type === 'prompt' && conversationId && !canSendPrompt(conversationId)) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">Prompt limit reached</p>
          <p className="text-xs text-muted-foreground">
            You've used all {limits.maxPromptsPerChat} prompts in this chat. Start a new chat or upgrade!
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => navigate('/settings?tab=subscription')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  // Show remaining prompts warning when low
  if (type === 'prompt' && conversationId && limits.maxPromptsPerChat !== Infinity) {
    const remaining = getPromptsRemaining(conversationId);
    if (remaining <= 3 && remaining > 0) {
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground">
            {remaining} prompt{remaining > 1 ? 's' : ''} remaining in this chat
          </p>
        </div>
      );
    }
  }

  return null;
}
