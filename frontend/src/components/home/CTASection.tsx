import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';

interface CTASectionProps {
  onGetStarted: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onGetStarted }) => {
  return (
    <section className="py-24 relative overflow-hidden bg-[#ECE9DF]/50 border-t border-[#DDD9CC]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="bg-white rounded-2xl p-8 sm:p-14 border border-[#DDD9CC] shadow-[0_24px_60px_-28px_rgba(27,31,39,0.2)]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs font-semibold mb-6">
            Ready for Production
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-[#1B1F27] tracking-tight mb-5">
            Empower Your Team with Verifiable Knowledge
          </h2>

          <p className="text-[#5B6270] text-base sm:text-lg max-w-2xl mx-auto mb-9 leading-relaxed">
            Upload policies, SOPs, and manuals in seconds. Get instant, grounded responses with inline citations and zero hallucinations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[3px] bg-[#1B1F27] text-[#F6F5F0] text-sm font-semibold hover:bg-[#2E6F5E] transition-colors shadow-sm w-full sm:w-auto"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://github.com/udayyyy-09/knowflow-AI#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <button
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[3px] border border-[#DDD9CC] text-[#1B1F27] text-sm font-semibold hover:border-[#1B1F27] bg-transparent transition-colors w-full sm:w-auto"
              >
                <BookOpen className="w-4 h-4" />
                <span>Read Documentation</span>
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
