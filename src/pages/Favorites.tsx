import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

// Favorites is a placeholder until the favorites feature is fully implemented.
// Wired into the bottom nav so the tab is never a dead click.
export default function Favorites() {
  return (
    <div className="container py-8 max-w-3xl mx-auto pb-24 md:pb-8">
      <h1 className="text-3xl font-bold mb-6">Your Favorites</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            No favorites yet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Tap the heart on any vehicle to save it here for later.
          </p>
          <Button asChild>
            <Link to="/explore">Browse cars</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
