import {
  HeroSection,
  FeaturedListings,
  AIAnalytics,
  InvestorTrust,
  SmartInsights,
  BlockchainSecurity,
  ARVRShowcase,
  DashboardPreview,
  OnboardingCTA,
  InvestCTA,
} from "@/components/homepage";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* 1. Cinematic full-viewport hero */}
      <HeroSection />

      {/* 2. Featured luxury property listings */}
      <FeaturedListings />

      {/* 3. AI analytics showcase */}
      <AIAnalytics />

      {/* 4. Investor trust & credibility */}
      <InvestorTrust />

      {/* 5. Dashboard preview widgets */}
      <DashboardPreview />

      {/* 6. Smart AI insights */}
      <SmartInsights />

      {/* 7. Blockchain security */}
      <BlockchainSecurity />

      {/* 8. AR/VR property experience */}
      <ARVRShowcase />

      {/* 9. Developer & broker onboarding */}
      <OnboardingCTA />

      {/* 10. Final investment CTA */}
      <InvestCTA />
    </div>
  );
}
