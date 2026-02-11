import { CreditCard } from "lucide-react";

export function PaymentOptionsCard() {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Payment options</h2>
      <div className="flex items-start gap-3">
        <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Flexible payment</p>
          <p className="text-muted-foreground text-sm">
            $0 due now when you choose the Refundable option at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
