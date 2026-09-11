import React from 'react';
import { Gauge, FileText, Cpu, Shield, Search, Lock } from 'lucide-react';
import { PointerHighlight } from "@/components/ui/pointer-highlight";

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: <Gauge className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'API Cost Guards & Capacity Limits',
      description:
        'Redis-backed rate limiting enforces token usage budgets and caps conversational turns, protecting enterprise budgets from runaway LLM API expenses.',
      badge: 'Cost Protection',
    },
    {
      icon: <FileText className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Multi-Format Async Ingestion',
      description:
        'Upload PDF, DOCX, Markdown, and TXT files. Asynchronous Celery workers handle text extraction, recursive chunking, and SHA-256 deduplication.',
      badge: 'Celery Pipelines',
    },
    {
      icon: <Cpu className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Langfuse Prompt Governance',
      description:
        'Production prompts managed in Langfuse with live versioning, TTL caching, and an infallible local static fallback for 100% uptime.',
      badge: 'Prompt CMS',
    },
    {
      icon: <Search className="w-5 h-5 text-[#A9772F]" />,
      title: 'Audit-Proof Source Citations',
      description:
        'Every factual claim carries inline [1], [2] footnotes linking back to the exact document, section header, page number, and similarity score.',
      badge: 'Zero Hallucination',
    },
    {
      icon: <Shield className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Indirect Prompt Injection Defense',
      description:
        'External document text is encapsulated in strict XML <context> boundaries with anti-injection system rules that neutralize malicious prompt overrides.',
      badge: 'Enterprise Security',
    },
    {
      icon: <Lock className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Workspace Isolation & RBAC',
      description:
        'Role-Based Access Control (Admin, Manager, Employee) enforces document privacy. Redis token-bucket rate limiters protect against budget exhaustion.',
      badge: 'Access Control',
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 relative border-t border-[#DDD9CC] bg-[#ECE9DF]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs font-semibold mb-4">
            Core Architecture
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1B1F27] tracking-tight">
            Built for Enterprise Scale, Speed,{' '}
            <span className="inline-block whitespace-nowrap">
              {' '}
              <PointerHighlight className="inline-block">
                <span>Compliance</span>
              </PointerHighlight>
            </span>
          </h2>
          <p className="text-[#5B6270] mt-4 text-base sm:text-lg leading-relaxed">
            A production-engineered RAG platform designed to replace ungrounded chatbots with a secure, auditable knowledge layer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 sm:p-7 border border-[#DDD9CC] shadow-[0_12px_36px_-20px_rgba(27,31,39,0.12)] hover:shadow-[0_20px_44px_-20px_rgba(27,31,39,0.2)] hover:border-[#1B1F27] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#ECE9DF] flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <span className="text-[11px] font-bold tracking-wider text-[#A9772F] uppercase">
                  {f.badge}
                </span>
                <h3 className="text-lg font-bold text-[#1B1F27] mt-2 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-[#5B6270] leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
