import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Rules {
  no_smoking?: boolean;
  keep_tidy?: boolean;
  refuel?: boolean;
  no_offroad?: boolean;
  smoking_fee_cents?: number;
  tidy_fee_cents?: number;
  telematics_disclosure?: string;
}

interface Props {
  rules: Rules;
  cancellation: { name: string; summary: string } | null;
}

const money = (cents?: number) => `$${((cents ?? 0) / 100).toFixed(0)}`;

/** Plain-language rental policies as expandable rows. */
export function PolicyAccordion({ rules, cancellation }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Rental policies</h2>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="fuel">
          <AccordionTrigger>Fuel and charging</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {rules.refuel === false
              ? "Return the vehicle with whatever fuel level you have — the host will handle refuelling."
              : "Return the vehicle with the same fuel or charge level you picked it up with. Otherwise a refuelling charge applies."}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="smoking">
          <AccordionTrigger>Smoking</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {rules.no_smoking === false
              ? "Ask the host before smoking in this vehicle."
              : `Smoking is not allowed in this vehicle. A cleaning charge of ${money(rules.smoking_fee_cents)} applies if it happens.`}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cleaning">
          <AccordionTrigger>Cleaning</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            Return the car in the condition you found it. Excessive dirt, sand or pet hair may lead to a cleaning
            charge of {money(rules.tidy_fee_cents)}.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="late">
          <AccordionTrigger>Late return</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            Let your host know as soon as you know you'll be late. Returns beyond the agreed time may be billed at the
            daily rate and can affect the next guest's booking.
          </AccordionContent>
        </AccordionItem>

        {rules.no_offroad !== false && (
          <AccordionItem value="offroad">
            <AccordionTrigger>Where you can drive</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Off-road driving is not permitted with this vehicle. Stick to paved and maintained roads.
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="cancellation">
          <AccordionTrigger>Cancellation</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {cancellation
              ? `${cancellation.name} — ${cancellation.summary}`
              : "Free cancellation is available up to the window shown at checkout. Exact terms are confirmed before you pay."}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tracking">
          <AccordionTrigger>Location tracking</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {rules.telematics_disclosure ||
              "This vehicle may carry a tracking device. Location is only recorded while a rental is active, and it is used for safety, theft recovery and trip verification."}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
