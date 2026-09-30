import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ExistingReview = {
  id: string;
  rating_overall: number;
  comment: string | null;
  created_at: string;
};

export function TripReviewCard({
  tripId,
  carId,
  reviewerId,
  tripStatus,
}: {
  tripId: string;
  carId: string;
  reviewerId: string;
  tripStatus: string;
}) {
  const { toast } = useToast();
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id,rating_overall,comment,created_at")
      .eq("trip_id", tripId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();

    setExisting(
      data
        ? {
            id: data.id,
            rating_overall: Number(data.rating_overall),
            comment: data.comment,
            created_at: data.created_at,
          }
        : null,
    );
    setLoading(false);
  }, [reviewerId, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (tripStatus !== "completed") return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-28 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        </CardContent>
      </Card>
    );
  }

  if (existing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Review submitted
          </CardTitle>
          <CardDescription>Your review is attached to this completed trip.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1" aria-label={`${existing.rating_overall} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-4 w-4 ${index < existing.rating_overall ? "fill-current text-amber-500" : "text-muted-foreground/40"}`}
                aria-hidden="true"
              />
            ))}
          </div>
          {existing.comment ? (
            <p className="mt-3 text-sm text-muted-foreground">{existing.comment}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      trip_id: tripId,
      car_id: carId,
      reviewer_id: reviewerId,
      rating_overall: rating,
      comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Review not submitted",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Review submitted",
      description: "Thanks for reviewing your completed Rentauto trip.",
    });
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rate this trip</CardTitle>
        <CardDescription>
          Reviews are available only after a completed rental and are tied to the booked vehicle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Overall rating</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Overall rating">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => setRating(value)}
                  className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={`h-7 w-7 ${value <= rating ? "fill-current text-amber-500" : "text-muted-foreground/40"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="trip-review-comment" className="mb-2 block text-sm font-medium">
            Comment <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="trip-review-comment"
            rows={4}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="How was the vehicle, pickup, cleanliness, and overall experience?"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length}/2000</p>
        </div>

        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Submit review
        </Button>
      </CardContent>
    </Card>
  );
}
