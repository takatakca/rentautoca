import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "How do I pick up the car?", a: "After you book, you'll meet your host at the pickup location. Complete the in-app check-in (photos + odometer + fuel) to start your trip." },
  { q: "What if I need to cancel?", a: "Free cancellation up to 24 hours before your trip. See the cancellation policy section above for full details." },
  { q: "Is insurance included?", a: "Every trip includes a protection plan you select at checkout. You can also bring your own insurance if it covers peer-to-peer rentals in Quebec." },
  { q: "Can I extend my trip?", a: "Yes — message your host through the app at least 4 hours before your scheduled return to request an extension." },
  { q: "What happens if I return late?", a: "A grace period of 15 minutes applies. After that, hourly late fees apply, then a full extra day after 3 hours." },
  { q: "Is the vehicle tracked?", a: "Tracking only runs while your trip is active (between check-in and check-out). See the tracking disclosure above." },
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
