import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Rentauto production SEO contracts", () => {
  const indexHtml = read("index.html");
  const routeMeta = read("src/components/seo/RouteMeta.tsx");
  const marketing = read("src/components/marketing/MarketingPage.tsx");
  const readme = read("README.md");

  it("uses rentauto.ca as the production canonical origin", () => {
    expect(indexHtml).toContain('rel="canonical" href="https://rentauto.ca/"');
    expect(indexHtml).toContain('property="og:url" content="https://rentauto.ca/"');
    expect(routeMeta).toContain('|| "https://rentauto.ca"');
    expect(indexHtml).not.toContain("rentautoca.lovable.app");
    expect(routeMeta).not.toContain("rentautoca.lovable.app");
  });

  it("does not claim unsupported inventory volume", () => {
    expect(routeMeta).not.toContain("Browse hundreds of cars");
    expect(marketing).not.toContain("Browse hundreds of cars");
  });

  it("documents GitHub-to-MochaHost as the production deployment authority", () => {
    expect(readme).toContain("GitHub Actions");
    expect(readme).toContain("MochaHost");
    expect(readme).toContain("CURRENT");
    expect(readme).not.toContain("Welcome to your Lovable project");
    expect(readme).not.toContain("Share -> Publish");
  });
});
