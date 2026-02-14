import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useKnowledgeUnits } from "@/hooks/useKnowledgeUnits";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Coins, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const [target, setTarget] = useState<"personal" | "group">("personal");
  const [selectedGroup, setSelectedGroup] = useState<string>("");

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

  const handlePurchase = async (pkg: (typeof KU_PACKAGES)[0]) => {
    if (!user?.email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    if (target === "group" && !selectedGroup) {
      toast({
        title: "Select a group",
        description: "Choose which group to top up.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(pkg.id);

    try {
      await loadPaystackScript();
      const reference = `ku_${pkg.id}_${target}_${user.id}_${Date.now()}`;

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: pkg.amount,
        currency: "NGN",
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: "Package", variable_name: "package", value: pkg.id },
            { display_name: "Target", variable_name: "target", value: target },
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: user.id,
            },
          ],
        },
        callback: (response: PaystackResponse) => {
          void (async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-ku`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                  reference: response.reference,
                  packageType: pkg.id,
                  target,
                  groupId: target === "group" ? selectedGroup : undefined,
                }),
              }
            );
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Verification failed");

            toast({
              title: "Knowledge Units added! 🧠",
              description: `${pkg.units} KU added to your ${target === "group" ? "group" : "personal"} wallet.`,
            });
            refetch();
            onSuccess?.();
          })()
            .catch((error) => {
              toast({
                title: "Verification failed",
                description:
                  error instanceof Error ? error.message : "Please contact support.",
                variant: "destructive",
              });
            })
            .finally(() => setProcessing(null));
        },
        onClose: () => setProcessing(null),
      });

      handler.openIframe();
    } catch (error) {
      toast({
        title: "Payment error",
        description: "Failed to initialize payment.",
        variant: "destructive",
      });
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
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
              onClick={() => handlePurchase(pkg)}
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

      <p className="text-xs text-muted-foreground text-center">
        1 Knowledge Unit = 1 prompt with Gideon. Like buying airtime — simple!
      </p>
    </div>
  );
}
