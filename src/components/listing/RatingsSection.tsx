import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

interface Review {
  id: string;
  rating_overall: number;
  comment: string | null;
  created_at: string;
  reviewer: { display_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  ratingAvg: number | null;
  ratingCount: number;
  subRatings: {
    cleanliness: number | null;
    maintenance: number | null;
    communication: number | null;
    convenience: number | null;
    accuracy: number | null;
  };
  reviews: Review[];
}

const ratingLabels: { key: keyof Props["subRatings"]; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "maintenance", label: "Maintenance" },
  { key: "communication", label: "Communication" },
  { key: "convenience", label: "Convenience" },
  { key: "accuracy", label: "Listing accuracy" },
];

export function RatingsSection({ ratingAvg, ratingCount, subRatings, reviews }: Props) {
  if (ratingCount === 0) {
    return (
      <div className="px-4 py-6">
        <h2 className="text-xl font-bold mb-2">Ratings and reviews</h2>
        <p className="text-muted-foreground">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-1">Ratings and reviews</h2>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl font-bold">{ratingAvg?.toFixed(1)}</span>
        <Star className="h-6 w-6 fill-primary text-primary" />
        <span className="text-muted-foreground">({ratingCount} ratings)</span>
      </div>

      {/* Sub-rating bars */}
      <div className="space-y-2 mb-6">
        {ratingLabels.map(({ key, label }) => {
          const val = subRatings[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-36 text-sm font-medium">{label}</span>
              <Progress value={val ? (val / 5) * 100 : 0} className="flex-1 h-2" />
              <span className="w-8 text-right text-sm font-semibold">{val?.toFixed(1) ?? "–"}</span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground mb-4">Based on {ratingCount} guest ratings</p>

      {/* Review carousel */}
      <Carousel opts={{ align: "start" }} className="w-full">
        <CarouselContent>
          {reviews.map((review) => (
            <CarouselItem key={review.id} className="basis-[85%] md:basis-1/2">
              <div className="bg-card border border-border rounded-xl p-4 h-48 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.reviewer?.avatar_url || ""} />
                    <AvatarFallback>
                      {(review.reviewer?.display_name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating_overall
                              ? "fill-primary text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground uppercase">
                        {review.reviewer?.display_name || "Guest"}
                      </span>
                      {" · "}
                      {format(new Date(review.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground flex-1 overflow-hidden line-clamp-4">
                  {review.comment || "No comment"}
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <button className="mt-4 text-primary font-semibold text-sm uppercase tracking-wide">
        SEE ALL REVIEWS
      </button>
    </div>
  );
}
