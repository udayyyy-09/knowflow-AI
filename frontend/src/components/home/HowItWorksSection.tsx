import React from 'react';
import { UploadCloud, Layers, MessageSquareText, ArrowRight } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Upload Policies & SOPs',
      subtitle: 'Connect Your Company Knowledge',
      description:
        'Drag and drop HR handbooks, finance policies, IT guidelines, or compliance manuals in PDF, Word, or Markdown into your secure workspace.',
      icon: <UploadCloud className="w-5 h-5 text-[#2E6F5E]" />,
      tag: 'Effortless Ingestion',
    },
    {
      step: '02',
      title: 'Intelligent Topic Structuring',
      subtitle: 'AI Knowledge Mapping',
      description:
        'KnowFlow instantly reads, categorizes, and organizes your files into secure conceptual topics — locked strictly to your team\'s access level.',
      icon: <Layers className="w-5 h-5 text-[#2E6F5E]" />,
      tag: 'Automatic Indexing',
    },
    {
      step: '03',
      title: 'Get Answers with Citations',
      subtitle: 'Ask in Plain English & Verify',
      description:
        'Ask conversational questions in chat. Receive instant, natural-language answers with clickable footnote references [1], [2] linked to exact document pages.',
      icon: <MessageSquareText className="w-5 h-5 text-[#A9772F]" />,
      tag: 'Instant Answers',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 relative border-t border-[#DDD9CC] bg-[#ECE9DF]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs font-semibold mb-4">
            Simple 3-Step Process
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1B1F27] tracking-tight">
            From Fragmented Files to Instant Verified Answers in 3 Simple Steps
          </h2>
          <p className="text-[#5B6270] mt-4 text-base sm:text-lg">
            Empower your organization with grounded, verifiable knowledge in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-7 relative flex flex-col justify-between border border-[#DDD9CC] shadow-[0_12px_36px_-20px_rgba(27,31,39,0.12)] hover:border-[#1B1F27] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#ECE9DF] flex items-center justify-center">
                    {s.icon}
                  </div>
                  <span className="text-2xl font-bold text-[#DDD9CC] font-mono">{s.step}</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#2E6F5E] px-2 py-0.5 rounded bg-[rgba(46,111,94,0.1)]">
                  {s.tag}
                </span>
                <h3 className="text-xl font-bold text-[#1B1F27] mt-3">{s.title}</h3>
                <h4 className="text-xs font-semibold text-[#A9772F] mb-3">{s.subtitle}</h4>
                <p className="text-sm text-[#5B6270] leading-relaxed">{s.description}</p>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-20 text-[#DDD9CC]">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
