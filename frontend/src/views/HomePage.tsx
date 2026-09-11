import React from 'react';
import { HomeNavbar } from '@/components/home/HomeNavbar';
import { HeroSection } from '@/components/home/HeroSection';
import { MacbookSection } from '@/components/home/MacbookSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { HowItWorksSection } from '@/components/home/HowItWorksSection';
import { FlowVisualizationSection } from '@/components/home/FlowVisualizationSection';
import { SecuritySection } from '@/components/home/SecuritySection';
import { CTASection } from '@/components/home/CTASection';
import { HomeFooter } from '@/components/home/HomeFooter';
import { useAuth } from '@/context/AuthContext';

interface HomePageProps {
  onEnterApp?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onEnterApp }) => {
  const { openAuthModal } = useAuth();

  const handleGetStarted = () => {
    openAuthModal('register');
  };

  const handleOpenLogin = (mode: 'login' | 'register' = 'login') => {
    openAuthModal(mode);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#ECE9DF]/50 text-[#1B1F27] selection:bg-[#2E6F5E] selection:text-[#F6F5F0]">
      {/* Top Sticky Navbar */}
      <HomeNavbar onOpenAuth={handleOpenLogin} onEnterApp={onEnterApp} />

      {/* Main Page Sections */}
      <main className="flex-2">
        {/* 1. Hero Section */}
        <HeroSection onGetStarted={handleGetStarted} onExploreDemo={handleGetStarted} />

        {/* 2. Interactive Spotlight with LinkPreview */}
        {/* <KnowledgeSpotlightSection /> */}

        {/* 3. Macbook Scroll Showcase */}
        <FeaturesSection />
        <FlowVisualizationSection />
        
        <MacbookSection />

        {/* 4. How It Works 3-Step Flow */}
        <HowItWorksSection />

        {/* 5. Interactive Animated Visualization of Flow (Mermaid Architecture Diagram) */}

        {/* 6. Security & Guardrails */}
        <SecuritySection />

        {/* 7. Final CTA Banner */}
        <CTASection onGetStarted={handleGetStarted} />
      </main>

      {/* Footer */}
      <HomeFooter />
    </div>
  );
};
