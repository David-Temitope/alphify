import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useKnowledgeUnits } from "@/hooks/useKnowledgeUnits";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Coins, Users, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const KU_PACKAGES = [
  { id: "starter", name: "Starter", units: 10, price: 500, amount: 50000 },
  { id: "standard", name: "Standard", units: 25, price: 1250, amount: 125000 },
  { id: "bulk", name: "Bulk", units: 50, price: 2500, amount: 250000 },
  { id: "mega", name: "Mega", units: 100, price: 5000, amount: 500000 },
];

interface KUPurchaseProps {
  onSuccess?: () => void;
}

export default function KUPurchase({ onSuccess }: KUPurchaseProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refetch } = useKnowledgeUnits();
  const [processing, setProcessing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [target, setTarget] = useState<"personal" | "group">("personal");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");

  const { data: adminGroups } = useQuery({
    queryKey: ["admin-groups", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("study_groups")
        .select("id, name")
        .eq("admin_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch pending checkouts for this user
  const { data: pendingCheckouts, refetch: refetchPending } = useQuery({
    queryKey: ["pending-checkouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("pending_checkouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000, // Poll every 15s to catch webhook completions
  });

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

  const savePendingCheckout = async (
    reference: string,
    units: number,
    amount: number,
    packageType?: string,
    customUnits?: number
  ) => {
    const { error } = await (supabase as any).from("pending_checkouts").insert({
      user_id: user!.id,
      reference,
      package_type: packageType || null,
      custom_units: customUnits || null,
      units,
      expected_amount: amount,
      target,
      group_id: target === "group" ? selectedGroup : null,
    });
    if (error) console.error("Failed to save pending checkout:", error);
  };

  const verifyPendingPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-ku`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ reference, fromPending: true }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Already processed - just refresh
          toast({ title: "Already credited ✅", description: "This payment was already added to your wallet." });
        } else {
          throw new Error(result.error || "Verification failed");
        }
      } else {
        toast({
          title: "Knowledge Units added! 🧠",
          description: `${result.units} KU added to your wallet.`,
        });
      }
      refetch();
      refetchPending();
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Payment still processing",
        description: "Your bank transfer may still be processing. We'll credit your KU automatically once confirmed.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const initiatePurchase = async (units: number, amount: number, label: string, packageType?: string) => {
    if (!user?.email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    if (target === "group" && !selectedGroup) {
      toast({ title: "Select a group", description: "Choose which group to top up.", variant: "destructive" });
      return;
    }

    setProcessing(label);

    try {
      await loadPaystackScript();
      const reference = `ku_${label}_${target}_${user.id}_${Date.now()}`;

      // Save pending checkout BEFORE opening Paystack
      await savePendingCheckout(
        reference,
        units,
        amount,
        packageType,
        packageType ? undefined : units
      );

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount,
        currency: "NGN",
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: "Package", variable_name: "package", value: label },
            { display_name: "Target", variable_name: "target", value: target },
            { display_name: "User ID", variable_name: "user_id", value: user.id },
          ],
        },
        callback: (response: PaystackResponse) => {
          void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-ku`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session?.access_token}`,
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({
                  reference: response.reference,
                  packageType: packageType || undefined,
                  customUnits: packageType ? undefined : units,
                  target,
                  groupId: target === "group" ? selectedGroup : undefined,
                }),
              }
            );

            const contentType = res.headers.get("content-type");
            if (!contentType?.includes("application/json")) {
              const text = await res.text();
              console.error("Non-JSON response from purchase-ku:", text.substring(0, 500));
              throw new Error("Payment was successful but verification got an unexpected response. Please contact support with your reference: " + response.reference);
            }

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Verification failed");

            toast({
              title: "Knowledge Units added! 🧠",
              description: `${units} KU added to your ${target === "group" ? "group" : "personal"} wallet.`,
            });
            refetch();
            refetchPending();
            onSuccess?.();
          })()
            .catch((error) => {
              toast({
                title: "Verification failed",
                description: error instanceof Error ? error.message : "Please contact support.",
                variant: "destructive",
              });
            })
            .finally(() => setProcessing(null));
        },
        onClose: () => {
          setProcessing(null);
          // Refresh pending checkouts - the webhook may process it
          refetchPending();
          toast({
            title: "Payment window closed",
            description: "If you completed a bank transfer, your KU will be credited automatically once the payment is confirmed. You can also tap 'Verify' below.",
          });
        },
      });

      handler.openIframe();
    } catch (error) {
      toast({ title: "Payment error", description: "Failed to initialize payment.", variant: "destructive" });
      setProcessing(null);
    }
  };

  const handlePackagePurchase = (pkg: (typeof KU_PACKAGES)[0]) => {
    initiatePurchase(pkg.units, pkg.amount, pkg.id, pkg.id);
  };

  const handleCustomPurchase = () => {
    const units = parseInt(customAmount, 10);
    if (!units || units < 1) {
      toast({ title: "Invalid amount", description: "Enter at least 1 KU.", variant: "destructive" });
      return;
    }
    const amount = units * 5000; // ₦50 per unit in kobo
    initiatePurchase(units, amount, `custom_${units}`);
  };

  return (
    <div className="space-y-6">
      {/* Pending Payments Banner */}
      {pendingCheckouts && pendingCheckouts.length > 0 && (
        <div className="p-4 rounded-xl bg-accent/20 border border-accent/40 space-y-3">
          <p className="text-sm font-medium text-accent-foreground">
            ⏳ You have {pendingCheckouts.length} pending payment{pendingCheckouts.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            If you completed a bank transfer, tap Verify to check if it's been confirmed.
          </p>
          {pendingCheckouts.map((checkout: any) => (
            <div key={checkout.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{checkout.units} KU</p>
                <p className="text-xs text-muted-foreground">
                  ₦{(checkout.expected_amount / 100).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => verifyPendingPayment(checkout.reference)}
                disabled={verifying}
                className="shrink-0"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Verify
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Target Toggle */}
      {adminGroups && adminGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="flex gap-2">
            <Button
              variant={target === "personal" ? "default" : "outline"}
              size="sm"
              onClick={() => setTarget("personal")}
            >
              <Coins className="h-4 w-4 mr-2" />
              For Me
            </Button>
            <Button
              variant={target === "group" ? "default" : "outline"}
              size="sm"
              onClick={() => setTarget("group")}
            >
              <Users className="h-4 w-4 mr-2" />
              For My Group
            </Button>
          </div>
          {target === "group" && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-48 bg-secondary">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {adminGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KU_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`glass-card p-5 rounded-2xl flex flex-col items-center text-center ${
              pkg.id === "standard" ? "border-primary border-2 shadow-lg shadow-primary/20" : ""
            }`}
          >
            <div className="text-3xl font-bold text-foreground mb-1">
              {pkg.units}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Knowledge Units
            </div>
            <div className="text-lg font-bold text-foreground mb-1">
              ₦{pkg.price.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mb-4">₦50/unit</div>
            <Button
              onClick={() => handlePackagePurchase(pkg)}
              disabled={processing !== null}
              className="w-full xp-gradient text-primary-foreground"
              size="sm"
            >
              {processing === pkg.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Buy"
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Custom Amount */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl bg-secondary/50 border border-border">
        <div className="flex-1 w-full">
          <label className="text-xs text-muted-foreground mb-1 block">Or enter custom amount</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              placeholder="e.g. 15"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">KU</span>
          </div>
        </div>
        {customAmount && parseInt(customAmount, 10) >= 1 && (
          <div className="text-sm font-medium text-foreground whitespace-nowrap">
            = ₦{(parseInt(customAmount, 10) * 50).toLocaleString()}
          </div>
        )}
        <Button
          onClick={handleCustomPurchase}
          disabled={processing !== null || !customAmount || parseInt(customAmount, 10) < 1}
          className="xp-gradient text-primary-foreground whitespace-nowrap"
          size="sm"
        >
          {processing?.startsWith("custom") ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy Custom"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        1 Knowledge Unit = 1 prompt with Gideon. Like buying airtime — simple!
      </p>
    </div>
  );
}
