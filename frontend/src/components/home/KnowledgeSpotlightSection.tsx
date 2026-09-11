import React from 'react';
import { LinkPreview } from '@/components/ui/link-preview';
import { Sparkles, ShieldCheck } from 'lucide-react';

export const KnowledgeSpotlightSection: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 md:px-8 bg-[#FDFCFA] border-y border-[#DDD9CC] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[rgba(46,111,94,0.04)] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.08)] border border-[rgba(46,111,94,0.2)] text-[#2E6F5E] text-xs font-semibold tracking-wide uppercase mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Footnote Grounding</span>
        </div>

        {/* Fancy Large LinkPreview Typography */}
        <p className="text-[#5B6270] text-2xl sm:text-3xl md:text-4xl leading-relaxed font-normal max-w-3xl mb-8">
          <span className="font-semibold text-[#1B1F27]">KnowFlow</span> lets your team ask questions in plain language and get answers grounded in your own{' '}
          <LinkPreview
            url="https://github.com/udayyyy-09/knowflow-AI"
            className="font-bold text-[#1B1F27] underline underline-offset-8 transition-colors"
          >
            policies
          </LinkPreview>
          ,{' '}
          <LinkPreview
            url="https://github.com/udayyyy-09/knowflow-AI"
            className="font-bold text-[#A9772F] underline decoration-[#A9772F]/40 underline-offset-8 hover:text-[#875f25] transition-colors"
          >
            SOPs
          </LinkPreview>
          , and{' '}
          <LinkPreview
            url="https://github.com/udayyyy-09/knowflow-AI#readme"
            className="font-bold text-[#1B1F27] underline decoration-[#1B1F27]/40 underline-offset-8 hover:text-[#2E6F5E] transition-colors"
          >
            manuals
          </LinkPreview>{' '}
          — with every claim linked back to the exact document it came from.
        </p>

        <p className="text-[#5B6270] text-lg sm:text-xl max-w-2xl leading-relaxed flex flex-wrap items-center justify-center gap-1.5">
          <span>Engineered on native</span>
          <LinkPreview
            url="https://github.com/pgvector/pgvector"
            className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#2E6F5E] to-[#A9772F]"
          >
            PostgreSQL pgvector
          </LinkPreview>
          <span>and sub-second inference with</span>
          <LinkPreview
            url="https://cloud.google.com/vertex-ai"
            className="font-bold text-[#1B1F27] underline decoration-[#1B1F27]/30 underline-offset-4"
          >
            Gemini 3.1 Flash
          </LinkPreview>
          <span>for zero-hallucination compliance.</span>
        </p>

        <div className="mt-10 flex items-center gap-2 text-xs font-semibold text-[#5B6270]">
          <ShieldCheck className="w-4 h-4 text-[#2E6F5E]" />
          <span>Every citation is verified against SHA-256 document chunk hashes</span>
        </div>
      </div>
    </section>
  );
};

export default KnowledgeSpotlightSection;
