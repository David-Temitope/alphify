import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SubscriptionPlan, PLAN_DISPLAY_PRICES } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";

// Paystack public key (publishable - safe to store in code)
const PAYSTACK_PUBLIC_KEY = "pk_live_b65b60f97ee0b66e9631df6b1301ef83d383913a";

interface PaystackResponse {
  reference: string;
  status: string;
  trans: string;
  transaction: string;
  message: string;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: {
          custom_fields?: {
            display_name: string;
            variable_name: string;
            value: string;
          }[];
        };
        callback: (response: PaystackResponse) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const planFeatures: Record<SubscriptionPlan, string[]> = {
  free: ["No access to features", "Upgrade to start learning"],
  basic: ["2 files in library", "1 chat per day", "15 prompts per chat", "Basic AI assistance"],
  pro: [
    "5 files in library",
    "3 chats per day",
    "25 prompts per chat",
    "Create study groups",
    "Upload exam samples",
    "Priority AI responses",
  ],
  premium: [
    "Unlimited library files",
    "Unlimited chats",
    "Unlimited prompts",
    "Create study groups",
    "Upload exam samples",
    "Premium badge in community",
    "Priority support",
  ],
};

const planIcons: Record<SubscriptionPlan, React.ReactNode> = {
  free: null,
  basic: <Zap className="h-5 w-5" />,
  pro: <Sparkles className="h-5 w-5" />,
  premium: <Crown className="h-5 w-5" />,
};

interface SubscriptionPlansProps {
  onSuccess?: () => void;
}

export default function SubscriptionPlans({ onSuccess }: SubscriptionPlansProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentPlan, isLoading } = useSubscription();
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null);

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paystack"));
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan: Exclude<SubscriptionPlan, "free">) => {
    if (!user?.email) {
      toast({
        title: "Email required",
        description: "Please add an email to your account first.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPlan(plan);

    try {
      await loadPaystackScript();

      const reference = `sub_${plan}_${user.id}_${Date.now()}`;
      const amount = plan === "basic" ? 300000 : plan === "pro" ? 500000 : 1000000;

      // Paystack validates that `callback` is a *plain* function. Some versions
      // of inline.js reject `async` functions, even though they are callable.
      // Keep the callback non-async and delegate async work inside.
      const verifyPaymentAndActivate = async (paystackReference: string) => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const verifyResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            reference: paystackReference,
            plan,
          }),
        });

        const isJson = verifyResponse.headers.get("content-type")?.toLowerCase().includes("application/json");

        const result = isJson ? await verifyResponse.json() : null;

        if (!verifyResponse.ok) {
          throw new Error(result?.error || "Payment verification failed");
        }

        toast({
          title: "Subscription activated!",
          description: `You're now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`,
        });
        onSuccess?.();

        // Reload to refresh subscription data
        window.location.reload();
      };

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount,
        currency: "NGN",
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: "Plan", variable_name: "plan", value: plan },
            { display_name: "User ID", variable_name: "user_id", value: user.id },
          ],
        },
        callback: (response: PaystackResponse) => {
          void (async () => {
            if (!response?.reference) {
              throw new Error("Missing Paystack reference. Please try again.");
            }
            await verifyPaymentAndActivate(response.reference);
          })()
            .catch((error) => {
              console.error("Payment verification error:", error);
              toast({
                title: "Verification failed",
                description: error instanceof Error ? error.message : "Please contact support if payment was deducted.",
                variant: "destructive",
              });
            })
            .finally(() => {
              setProcessingPlan(null);
            });
        },
        onClose: () => {
          setProcessingPlan(null);
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast({
        title: "Payment error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setProcessingPlan(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const plans: Array<Exclude<SubscriptionPlan, "free">> = ["basic", "pro", "premium"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map((plan) => {
        const isCurrentPlan = currentPlan === plan;
        const isPro = plan === "pro";

        return (
          <div
            key={plan}
            className={`relative glass-card p-6 rounded-2xl flex flex-col ${
              isPro ? "border-primary border-2 shadow-lg shadow-primary/20" : ""
            }`}
          >
            {isPro && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Most Popular
              </Badge>
            )}

            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  plan === "premium"
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                    : plan === "pro"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                }`}
              >
                {planIcons[plan]}
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg capitalize">{plan}</h3>
                <p className="text-2xl font-bold text-foreground">
                  {PLAN_DISPLAY_PRICES[plan]}
                  <span className="text-sm text-muted-foreground font-normal">/mo</span>
                </p>
              </div>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {planFeatures[plan].map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleSubscribe(plan)}
              disabled={isCurrentPlan || processingPlan !== null}
              className={`w-full ${
                isCurrentPlan
                  ? "bg-secondary text-foreground cursor-default"
                  : isPro
                    ? "xp-gradient text-primary-foreground"
                    : ""
              }`}
              variant={isCurrentPlan ? "secondary" : isPro ? "default" : "outline"}
            >
              {processingPlan === plan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isCurrentPlan ? (
                "Current Plan"
              ) : (
                "Subscribe"
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
