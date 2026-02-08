import { useHostCompletion } from "@/hooks/use-host-completion";
import { CompletionProgress } from "@/components/host/CompletionProgress";
import { BasicInfoForm } from "@/components/host/BasicInfoForm";
import { LocationForm } from "@/components/host/LocationForm";
import { VerificationUpload } from "@/components/host/VerificationUpload";
import { PreferencesForm } from "@/components/host/PreferencesForm";
import { StripeStatusCard } from "@/components/host/StripeStatusCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Circle, Loader2 } from "lucide-react";

function SectionIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <CheckCircle className="h-5 w-5 text-success shrink-0" />;
    case "incomplete":
      return <AlertCircle className="h-5 w-5 text-warning shrink-0" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground shrink-0" />;
  }
}

export default function HostOnboarding() {
  const completion = useHostCompletion();

  if (completion.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderForm = (sectionId: string) => {
    switch (sectionId) {
      case "basic-info":
        return <BasicInfoForm data={completion.data.profile} onSaved={completion.refresh} />;
      case "location":
        return <LocationForm data={completion.data.profile} onSaved={completion.refresh} />;
      case "verification":
        return <VerificationUpload data={completion.data.verification} onSaved={completion.refresh} />;
      case "payout":
        return <StripeStatusCard />;
      case "preferences":
        return (
          <PreferencesForm
            data={completion.data.preferences}
            onSaved={completion.refresh}
            sectionFocus="preferences"
          />
        );
      case "emergency":
        return (
          <PreferencesForm
            data={completion.data.preferences}
            onSaved={completion.refresh}
            sectionFocus="emergency"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      <CompletionProgress
        percentage={completion.percentage}
        canPublish={completion.canPublish}
        canAcceptBookings={completion.canAcceptBookings}
        sections={completion.sections}
      />

      <Accordion type="single" collapsible className="space-y-3 mt-6">
        {completion.sections.map((section) => (
          <AccordionItem
            key={section.id}
            value={section.id}
            className="border rounded-lg px-4 bg-card"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3 text-left w-full mr-2">
                <SectionIcon status={section.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm sm:text-base">{section.label}</span>
                    <Badge
                      variant={section.required ? "secondary" : "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {section.required ? "Required" : "Optional"}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {section.description}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-6">
              {renderForm(section.id)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
