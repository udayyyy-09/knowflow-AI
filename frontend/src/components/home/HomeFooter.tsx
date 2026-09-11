import React from 'react';
import { FloatingDock } from '@/components/ui/floating-dock';
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconExchange,
  IconHome,
  IconShieldLock,
  IconTerminal2,
  IconBook2,
} from '@tabler/icons-react';

export const HomeFooter: React.FC = () => {
  const dockLinks = [
    {
      title: 'Home',
      icon: <IconHome className="h-full w-full text-[#1B1F27]" />,
      href: '#',
    },
    {
      title: 'RAG Features',
      icon: <IconTerminal2 className="h-full w-full text-[#2E6F5E]" />,
      href: '#features',
    },
    {
      title: 'ETL Pipeline',
      icon: <IconExchange className="h-full w-full text-[#A9772F]" />,
      href: '#how-it-works',
    },
    {
      title: 'Security & RBAC',
      icon: <IconShieldLock className="h-full w-full text-[#1B1F27]" />,
      href: '#security',
    },
    {
      title: 'KnowFlow Core',
      icon: (
        <div className="w-5 h-5 rounded bg-[#1B1F27] flex items-center justify-center text-white text-[11px] font-serif font-black">
          K
        </div>
      ),
      href: '#',
    },
    {
      title: 'API & Docs',
      icon: <IconBook2 className="h-full w-full text-[#2E6F5E]" />,
      href: 'https://github.com/udayyyy-09/knowflow-AI#readme',
      target: '_blank'
    },
    {
      title: 'LinkedIn',
      icon: <IconBrandLinkedin className="h-full w-full text-[#0A66C2]" />,
      href: 'https://www.linkedin.com/in/uday-chaudhary-b24b08290/',
      target: '_blank'
    },
    {
      title: 'GitHub',
      icon: <IconBrandGithub className="h-full w-full text-[#1B1F27]" />,
      href: 'https://github.com/udayyyy-09/knowflow-AI',
      target: '_blank'
    },
  ];

  return (
    <footer className="border-t border-[#DDD9CC] bg-[#ECE9DF]/50 pt-16 pb-12 text-[#5B6270] text-xs relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Floating Dock Navigation */}
        <div className="mb-12 flex flex-col items-center">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#5B6270] mb-4">
            Quick Navigation & Resources
          </p>
          <FloatingDock
            items={dockLinks}
            desktopClassName="shadow-md border border-[#DDD9CC] bg-white/95"
            mobileClassName=""
          />
        </div>

        {/* Bottom copyright & attribution */}
        <div className="w-full pt-6 border-t border-[#DDD9CC] flex flex-col sm:flex-row items-center justify-between gap-4 text-center text-[#5B6270] text-[11px]">
          <div className="flex items-center gap-2 font-bold text-xs text-[#1B1F27]">
            <div className="w-4 h-4 rounded bg-[#1B1F27] flex items-center justify-center text-white text-[9px] font-serif font-bold">
              K
            </div>
            <span>KnowFlow AI</span>
            <span className="text-[#DDD9CC] font-normal">•</span>
            <span className="text-[#5B6270] font-normal">Enterprise Knowledge Assistant</span>
          </div>

          <div>
            © {new Date().getFullYear()} KnowFlow AI. High-assurance RAG engine with verifiable footnote grounding.
          </div>

          <div className="flex items-center gap-3">
            <span className="px-1.5 py-0.5 rounded bg-[rgba(46,111,94,0.1)] text-[#2E6F5E] font-semibold text-[10px]">
              MIT License
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default HomeFooter;
