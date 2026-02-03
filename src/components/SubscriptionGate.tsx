import { ReactNode } from 'react';
import { useSubscription, SubscriptionPlan, PLAN_DISPLAY_PRICES } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Lock, Crown, Sparkles, Zap } from 'lucide-react';

interface SubscriptionGateProps {
  children: ReactNode;
  requiredPlans: SubscriptionPlan[];
  feature: string;
  fallback?: ReactNode;
}

export default function SubscriptionGate({ 
  children, 
  requiredPlans, 
  feature,
  fallback 
}: SubscriptionGateProps) {
  const { currentPlan, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const hasAccess = requiredPlans.includes(currentPlan);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const lowestPlan = requiredPlans[0];
  const planIcon = lowestPlan === 'premium' ? <Crown className="h-8 w-8" /> : 
                   lowestPlan === 'pro' ? <Sparkles className="h-8 w-8" /> : 
                   <Zap className="h-8 w-8" />;

  return (
    <div className="glass-card p-8 rounded-2xl text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
        <Lock className="h-8 w-8" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{feature}</h3>
      <p className="text-muted-foreground mb-6">
        Upgrade to {lowestPlan.charAt(0).toUpperCase() + lowestPlan.slice(1)} ({PLAN_DISPLAY_PRICES[lowestPlan]}/mo) to unlock this feature.
      </p>
      <Button 
        onClick={() => navigate('/settings?tab=subscription')}
        className="xp-gradient text-primary-foreground"
      >
        {planIcon}
        <span className="ml-2">Upgrade Now</span>
      </Button>
    </div>
  );
}
