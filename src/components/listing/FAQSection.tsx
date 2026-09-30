import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "How do I pick up the car?", a: "After you book, you'll meet your host at the pickup location. Complete the in-app check-in (photos + odometer + fuel) to start your trip." },
  { q: "What if I need to cancel?", a: "The cancellation terms that apply to your trip are shown before payment and stored with the booking." },
  { q: "What protection applies to my trip?", a: "The checkout will show the protection option and contractual terms that actually apply before you pay. Pre-launch plan names or examples are not insurance promises." },
  { q: "Can I extend my trip?", a: "Request an extension through the trip screen. The host must confirm and the vehicle must remain available." },
  { q: "What happens if I return late?", a: "Your booking shows the applicable return and late-return terms. Contact the host through the trip screen as early as possible if your return time may change." },
  { q: "Is the vehicle tracked?", a: "If the listing discloses tracking, location collection is limited to the active rental window. See the tracking disclosure for details." },
];

export function FAQSection() {
  return (
    <section className="px-4 py-5">
      <h2 className="text-xl font-bold mb-3">Frequently asked questions</h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-sm font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
