import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface MarketingPageProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  children: ReactNode;
}

export function MarketingPage({
  eyebrow,
  title,
  subtitle,
  primaryCta = { label: "Browse cars", to: "/explore" },
  secondaryCta,
  children,
}: MarketingPageProps) {
  return (
    <div className="pb-24 md:pb-16">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-accent/40 via-background to-background">
        <div className="container max-w-5xl py-14 md:py-20">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{eyebrow}</p>
          )}
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground max-w-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 md:mt-5 text-base md:text-lg text-muted-foreground max-w-2xl">
              {subtitle}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to={primaryCta.to}>
                {primaryCta.label}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            {secondaryCta && (
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="container max-w-5xl py-12 md:py-16 space-y-16">{children}</div>
    </div>
  );
}

export function MarketingSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function FeatureGrid({
  items,
}: {
  items: { icon: ReactNode; title: string; body: string }[];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
            {item.icon}
          </div>
          <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function FAQSection({ items }: { items: { q: string; a: string }[] }) {
  return (
    <MarketingSection title="Frequently asked questions">
      <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
        {items.map((item) => (
          <details key={item.q} className="group p-5 open:bg-accent/20">
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-foreground">
              {item.q}
              <span className="text-primary text-xl leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </MarketingSection>
  );
}

export function FinalCTA({
  title = "Ready to hit the road?",
  body = "Browse hundreds of cars from trusted local hosts across Quebec and Canada.",
  primary = { label: "Browse cars", to: "/explore" },
  secondary = { label: "Become a host", to: "/become-host" },
}: {
  title?: string;
  body?: string;
  primary?: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  return (
    <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-card p-8 md:p-12 text-center">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="rounded-full">
          <Link to={primary.to}>{primary.label}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full">
          <Link to={secondary.to}>{secondary.label}</Link>
        </Button>
      </div>
    </section>
  );
}
