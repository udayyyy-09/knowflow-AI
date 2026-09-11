import React, { useState } from 'react';
import { HoveredLink, Menu, MenuItem, ProductItem } from '@/components/ui/navbar-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, LogIn, Sparkles, ShieldCheck, Database, Cpu, FileText, Zap, Activity } from 'lucide-react';

interface HomeNavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterApp?: () => void;
}

export const HomeNavbar: React.FC<HomeNavbarProps> = ({ onOpenAuth, onEnterApp }) => {
  const { isAuthenticated, user } = useAuth();
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="sticky top-4 z-50 w-full px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand Logo */}
        <a
          href="#"
          className="flex items-center gap-2.5 font-bold text-base tracking-tight text-[#1B1F27] shrink-0 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-full border border-[#DDD9CC] shadow-sm hover:border-[#1B1F27] transition-all"
        >
          <div className="w-5 h-5 rounded bg-[#1B1F27] flex items-center justify-center text-white text-xs font-serif font-black">
            K
          </div>
          <span className="font-semibold text-sm">KnowFlow</span>
          
        </a>

        {/* Center: Aceternity Interactive Navbar Menu */}
        <div className={cn('hidden md:block relative z-50')}>
          <Menu setActive={setActive}>
            {/* 1. Solutions (Business & Operational Impact) */}
            <MenuItem setActive={setActive} active={active} item="Solutions">
              <div className="flex flex-col space-y-2 text-sm p-1 min-w-[240px]">
                <HoveredLink href="#features">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Database className="w-4 h-4 text-[#2E6F5E]" />
                    <span>Central Knowledge Hub</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Organize all company policies, guides, and docs in one place
                  </div>
                </HoveredLink>

                <HoveredLink href="#features">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Zap className="w-4 h-4 text-[#A9772F]" />
                    <span>Instant AI Answers</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Ask questions in plain English and get real-time responses
                  </div>
                </HoveredLink>

                <HoveredLink href="#how-it-works">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <FileText className="w-4 h-4 text-[#2E6F5E]" />
                    <span>Verified Citations</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Every answer links directly to the exact page and source
                  </div>
                </HoveredLink>

                <HoveredLink href="#security">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <ShieldCheck className="w-4 h-4 text-[#1B1F27]" />
                    <span>Team Privacy & Access</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Keep company data safe with secure workspace permissions
                  </div>
                </HoveredLink>
              </div>
            </MenuItem>

            {/* 2. Products (Clean feature highlights) */}
            <MenuItem setActive={setActive} active={active} item="Features">
              <div className="grid grid-cols-2 gap-4 p-2 text-sm max-w-2xl">
                <ProductItem
                  title="Knowledge Search"
                  href="#features"
                  src="https://assets.aceternity.com/demos/algochurn.webp"
                  description="Find accurate answers across all your company documents instantly."
                />
                <ProductItem
                  title="Document Processing"
                  href="#how-it-works"
                  src="https://assets.aceternity.com/demos/tailwindmasterkit.webp"
                  description="Automatic reading and indexing for PDFs, Word files, and text."
                />
                <ProductItem
                  title="AI Guardrails"
                  href="#security"
                  src="https://assets.aceternity.com/demos/Screenshot+2024-02-21+at+11.51.31%E2%80%AFPM.png"
                  description="Strict accuracy controls that prevent guessing and hallucinations."
                />
                <ProductItem
                  title="Source Verification"
                  href="#features"
                  src="https://assets.aceternity.com/demos/Screenshot+2024-02-21+at+11.47.07%E2%80%AFPM.png"
                  description="Clickable references showing the exact document text behind every answer."
                />
              </div>
            </MenuItem>

            {/* 3. Architecture & Tech */}
            <MenuItem setActive={setActive} active={active} item="Architecture">
              <div className="flex flex-col space-y-2 text-sm p-1 min-w-[240px]">
                <HoveredLink href="#flow-visualization">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Activity className="w-4 h-4 text-[#2E6F5E]" />
                    <span>How It Works (Live Flow)</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Interactive visual trace from document upload to final answer
                  </div>
                </HoveredLink>

                <HoveredLink href="https://github.com/udayyyy-09/knowflow-AI" target="_blank">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Cpu className="w-4 h-4 text-[#2E6F5E]" />
                    <span>Vector Database</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Fast and accurate search engine powered by PostgreSQL
                  </div>
                </HoveredLink>

                <HoveredLink href="https://github.com/udayyyy-09/knowflow-AI" target="_blank">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Database className="w-4 h-4 text-[#A9772F]" />
                    <span>Background Workers</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    High-speed document parsing and vector indexing
                  </div>
                </HoveredLink>

                <HoveredLink href="https://github.com/udayyyy-09/knowflow-AI" target="_blank">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <Sparkles className="w-4 h-4 text-[#2E6F5E]" />
                    <span>Fast AI Models</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Real-time answer generation powered by Google Gemini
                  </div>
                </HoveredLink>

                <HoveredLink href="https://github.com/udayyyy-09/knowflow-AI#readme" target="_blank">
                  <div className="flex items-center gap-2 font-semibold text-[#1B1F27]">
                    <FileText className="w-4 h-4 text-[#1B1F27]" />
                    <span>Developer API</span>
                  </div>
                  <div className="text-xs text-[#5B6270] pl-6">
                    Simple REST APIs to integrate KnowFlow with your existing tools
                  </div>
                </HoveredLink>
              </div>
            </MenuItem>
          </Menu>
        </div>

        {/* Right: Auth Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isAuthenticated ? (
            <button
              onClick={onEnterApp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1B1F27] text-[#F6F5F0] text-xs font-semibold hover:bg-[#2E6F5E] transition-colors shadow-sm cursor-pointer"
            >
              <span>Workspace ({user?.first_name || 'Dashboard'})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={() => onOpenAuth('login')}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/90 backdrop-blur-md border border-[#DDD9CC] text-[#1B1F27] text-xs font-semibold hover:border-[#1B1F27] transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 rounded-full bg-[#1B1F27] text-[#F6F5F0] text-xs font-semibold hover:bg-[#2E6F5E] transition-colors shadow-sm cursor-pointer"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeNavbar;
