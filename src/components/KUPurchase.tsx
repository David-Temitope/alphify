import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useKnowledgeUnits } from "@/hooks/useKnowledgeUnits";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Coins, Users, RefreshCw, Wallet, TrendingUp, Star, Zap } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_b65b60f97ee0b66e9631df6b1301ef83d383913a";

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
        key: string; email: string; amount: number; currency: string; ref: string;
        metadata?: { custom_fields?: { display_name: string; variable_name: string; value: string }[] };
        callback: (response: PaystackResponse) => void; onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const KU_PACKAGES = [
  { id: "starter", name: "Starter", units: 10, price: 350, amount: 35000, icon: Coins, accent: "from-blue-500/20 to-blue-600/10 border-blue-500/30" },
  { id: "standard", name: "Standard", units: 25, price: 875, amount: 87500, icon: Star, accent: "from-primary/20 to-primary/10 border-primary/40", popular: true },
  { id: "bulk", name: "Bulk", units: 50, price: 1750, amount: 175000, icon: TrendingUp, accent: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30" },
  { id: "mega", name: "Mega", units: 100, price: 3500, amount: 350000, icon: Zap, accent: "from-amber-500/20 to-amber-600/10 border-amber-500/30" },
];

interface KUPurchaseProps {
  onSuccess?: () => void;
}

export default function KUPurchase({ onSuccess }: KUPurchaseProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { balance, refetch } = useKnowledgeUnits();
  const [processing, setProcessing] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [target, setTarget] = useState<"personal" | "group">("personal");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");

  const { data: adminGroups } = useQuery({
    queryKey: ["admin-groups", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("study_groups").select("id, name").eq("admin_id", user.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingCheckouts, refetch: refetchPending } = useQuery({
    queryKey: ["pending-checkouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("pending_checkouts").select("*").eq("user_id", user.id)
        .eq("status", "pending").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paystack"));
      document.body.appendChild(script);
    });
  };

  const savePendingCheckout = async (reference: string, units: number, amount: number, packageType?: string, customUnits?: number) => {
    const { error } = await (supabase as any).from("pending_checkouts").insert({
      user_id: user!.id, reference, package_type: packageType || null,
      custom_units: customUnits || null, units, expected_amount: amount,
      target, group_id: target === "group" ? selectedGroup : null,
    });
    if (error) console.error("Failed to save pending checkout:", error);
  };

  const verifyPendingPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-ku`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ reference, fromPending: true }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: "Already credited ✅", description: "This payment was already added to your wallet." });
        } else { throw new Error(result.error || "Verification failed"); }
      } else {
        toast({ title: "Knowledge Units added! 🧠", description: `${result.units} KU added to your wallet.` });
      }
      refetch(); refetchPending(); onSuccess?.();
    } catch (error) {
      toast({ title: "Payment still processing", description: "Your bank transfer may still be processing. We'll credit your KU automatically once confirmed.", variant: "destructive" });
    } finally { setVerifying(false); }
  };

  const initiatePurchase = async (units: number, amount: number, label: string, packageType?: string) => {
    if (!user?.email) { toast({ title: "Email required", variant: "destructive" }); return; }
    if (target === "group" && !selectedGroup) { toast({ title: "Select a group", description: "Choose which group to top up.", variant: "destructive" }); return; }
    setProcessing(label);
    try {
      await loadPaystackScript();
      const reference = `ku_${label}_${target}_${user.id}_${Date.now()}`;
      await savePendingCheckout(reference, units, amount, packageType, packageType ? undefined : units);
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, email: user.email, amount, currency: "NGN", ref: reference,
        metadata: { custom_fields: [
          { display_name: "Package", variable_name: "package", value: label },
          { display_name: "Target", variable_name: "target", value: target },
          { display_name: "User ID", variable_name: "user_id", value: user.id },
        ]},
        callback: (response: PaystackResponse) => {
          void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-ku`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
              body: JSON.stringify({ reference: response.reference, packageType: packageType || undefined, customUnits: packageType ? undefined : units, target, groupId: target === "group" ? selectedGroup : undefined }),
            });
            const contentType = res.headers.get("content-type");
            if (!contentType?.includes("application/json")) {
              const text = await res.text();
              console.error("Non-JSON response from purchase-ku:", text.substring(0, 500));
              throw new Error("Payment was successful but verification got an unexpected response. Please contact support with your reference: " + response.reference);
            }
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Verification failed");
            toast({ title: "Knowledge Units added! 🧠", description: `${units} KU added to your ${target === "group" ? "group" : "personal"} wallet.` });
            refetch(); refetchPending(); onSuccess?.();
          })().catch((error) => {
            toast({ title: "Verification failed", description: error instanceof Error ? error.message : "Please contact support.", variant: "destructive" });
          }).finally(() => setProcessing(null));
        },
        onClose: () => {
          setProcessing(null);
          refetchPending();
          toast({ title: "Payment window closed", description: "If you completed a bank transfer, your KU will be credited automatically once the payment is confirmed. You can also tap 'Verify' below." });
        },
      });
      handler.openIframe();
    } catch (error) {
      toast({ title: "Payment error", description: "Failed to initialize payment.", variant: "destructive" });
      setProcessing(null);
    }
  };

  const handlePackagePurchase = (pkg: (typeof KU_PACKAGES)[0]) => { initiatePurchase(pkg.units, pkg.amount, pkg.id, pkg.id); };
  const handleCustomPurchase = () => {
    const units = parseInt(customAmount, 10);
    if (!units || units < 1) { toast({ title: "Invalid amount", description: "Enter at least 1 KU.", variant: "destructive" }); return; }
    initiatePurchase(units, units * 3500, `custom_${units}`);
  };

  return (
    <div className="space-y-5">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5">
        <div className="absolute top-3 right-3 opacity-10">
          <Wallet className="h-16 w-16 text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Available Balance</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">{balance}</span>
          <span className="text-sm font-medium text-muted-foreground">KU</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">₦35 per Knowledge Unit</p>
        {balance <= 5 && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${balance === 0 ? 'bg-destructive' : 'bg-amber-500'} animate-pulse`} />
            <p className="text-xs font-medium text-muted-foreground">
              {balance === 0 ? 'No units left — top up to continue!' : 'Running low — top up soon!'}
            </p>
          </div>
        )}
      </div>

      {/* Pending Payments */}
      {pendingCheckouts && pendingCheckouts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Transactions</h3>
          {pendingCheckouts.map((checkout: any) => (
            <div key={checkout.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{checkout.units} KU</p>
                <p className="text-xs text-muted-foreground">₦{(checkout.expected_amount / 100).toLocaleString()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => verifyPendingPayment(checkout.reference)} disabled={verifying} className="rounded-full text-xs h-8">
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Verify</>}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Target Toggle */}
      {adminGroups && adminGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
          <div className="flex gap-2">
            <Button variant={target === "personal" ? "default" : "outline"} size="sm" onClick={() => setTarget("personal")} className="rounded-full text-xs h-8">
              <Coins className="h-3.5 w-3.5 mr-1.5" /> For Me
            </Button>
            <Button variant={target === "group" ? "default" : "outline"} size="sm" onClick={() => setTarget("group")} className="rounded-full text-xs h-8">
              <Users className="h-3.5 w-3.5 mr-1.5" /> For Group
            </Button>
          </div>
          {target === "group" && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-44 h-8 bg-secondary text-xs"><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>{adminGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Top Up Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Up</h3>
        <div className="grid grid-cols-2 gap-3">
          {KU_PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <button
                key={pkg.id}
                onClick={() => handlePackagePurchase(pkg)}
                disabled={processing !== null}
                className={`relative p-4 rounded-2xl bg-gradient-to-br ${pkg.accent} border text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <Icon className="h-5 w-5 text-foreground/60 mb-2" />
                <p className="text-2xl font-bold text-foreground">{pkg.units}</p>
                <p className="text-[11px] text-muted-foreground mb-2">Knowledge Units</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-foreground">₦{pkg.price.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground">₦35/unit</span>
                </div>
                {processing === pkg.id && (
                  <div className="absolute inset-0 bg-background/60 rounded-2xl flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Amount */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Amount</h3>
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} placeholder="Enter units"
                  value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  className="bg-secondary border-border h-10"
                />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">KU</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            {customAmount && parseInt(customAmount, 10) >= 1 ? (
              <p className="text-sm font-medium text-foreground">
                Total: ₦{(parseInt(customAmount, 10) * 35).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">₦35 per unit</p>
            )}
            <Button
              onClick={handleCustomPurchase}
              disabled={processing !== null || !customAmount || parseInt(customAmount, 10) < 1}
              size="sm" className="rounded-full bg-primary text-primary-foreground h-8 text-xs"
            >
              {processing?.startsWith("custom") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buy"}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        Knowledge Units — like buying airtime for learning. Simple!
      </p>
    </div>
  );
}
