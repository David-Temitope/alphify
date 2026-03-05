import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Tag, CheckCircle, Gift } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface PromoInfo {
  code: string;
  bonusKu: number;
  subaccountCode: string | null;
}

interface PromoCodeModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: (promo: PromoInfo | null) => void;
  units: number;
  amount: number;
}

export default function PromoCodeModal({ open, onClose, onProceed, units, amount }: PromoCodeModalProps) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [promoResult, setPromoResult] = useState<{ valid: boolean; bonusKu: number; subaccountCode: string | null } | null>(null);

  const validateCode = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setPromoResult(null);
    try {
      const { data } = await supabase
        .from("promo_codes")
        .select("id, code, bonus_ku, subaccount_code, expires_at")
        .eq("code", code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (!data) {
        setPromoResult({ valid: false, bonusKu: 0, subaccountCode: null });
        return;
      }

      // Check expiry
      if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        setPromoResult({ valid: false, bonusKu: 0, subaccountCode: null });
        return;
      }

      setPromoResult({
        valid: true,
        bonusKu: (data as any).bonus_ku ?? 5,
        subaccountCode: (data as any).subaccount_code ?? null,
      });
    } catch {
      setPromoResult({ valid: false, bonusKu: 0, subaccountCode: null });
    } finally {
      setChecking(false);
    }
  };

  const handleProceed = () => {
    if (promoResult?.valid) {
      onProceed({
        code: code.toUpperCase().trim(),
        bonusKu: promoResult.bonusKu,
        subaccountCode: promoResult.subaccountCode,
      });
    } else {
      onProceed(null);
    }
    setCode("");
    setPromoResult(null);
  };

  const handleClose = () => {
    setCode("");
    setPromoResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Promo Code
          </DialogTitle>
          <DialogDescription>
            Have a promo code? Enter it below for bonus KU. You can also skip this step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order summary */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">KU</span>
              <span className="font-semibold text-foreground">{units}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold text-foreground">₦{(amount / 100).toLocaleString()}</span>
            </div>
            {promoResult?.valid && (
              <div className="flex justify-between text-sm mt-1 text-primary">
                <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Bonus</span>
                <span className="font-semibold">+{promoResult.bonusKu} KU free!</span>
              </div>
            )}
          </div>

          {/* Promo input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter promo code"
              value={code}
              onChange={(e) => { setCode(e.target.value); setPromoResult(null); }}
              className="bg-secondary border-border uppercase"
            />
            <Button
              variant="outline" size="sm"
              onClick={validateCode}
              disabled={checking || !code.trim()}
              className="rounded-full h-9 px-4 text-xs"
            >
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </Button>
          </div>

          {promoResult?.valid && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle className="h-3.5 w-3.5" />
              Promo code applied! You'll get {promoResult.bonusKu} bonus KU.
            </div>
          )}
          {promoResult && !promoResult.valid && (
            <p className="text-xs text-destructive">Invalid or expired promo code.</p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleProceed} className="text-xs">
            Skip &amp; Pay
          </Button>
          <Button onClick={handleProceed} className="rounded-full">
            {promoResult?.valid ? "Pay with Promo" : "Continue to Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
