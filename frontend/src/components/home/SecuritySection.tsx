import React from 'react';
import { ShieldAlert, Users, Gauge, CheckCheck, Zap, Sliders } from 'lucide-react';

export const SecuritySection: React.FC = () => {
  const securityItems = [
    {
      icon: <ShieldAlert className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Prompt Injection Neutralization',
      text: 'Encapsulates external document text inside strict XML <context> delimiters. Anti-injection directives command the LLM to treat document text strictly as inert data, nullifying malicious overrides.',
    },
    {
      icon: <Users className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Tenant Boundary Isolation',
      text: 'Every document, chunk, vector embedding, and conversation thread is strictly scoped by workspace ID in PostgreSQL, ensuring users cannot access documents from unassigned workspaces.',
    },
    {
      icon: <Sliders className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Dynamic Token Budgeting',
      text: 'Token Budget Manager enforces a 3,072-token cap, evicting low-scoring chunks and truncating history turns to prevent model context window overflow.',
    },
    {
      icon: <Gauge className="w-5 h-5 text-[#A9772F]" />,
      title: 'Rate Limits & Capacity Guards',
      text: 'Redis token-bucket rate limiting enforces 10 rpm per user and 60 rpm per workspace. Conversation threads are capped at 50 messages to prevent runaway API costs.',
    },
    {
      icon: <CheckCheck className="w-5 h-5 text-[#A9772F]" />,
      title: 'Hallucination & Citation Sanitizer',
      text: 'The CitationValidator parses bracket citations, automatically strips out-of-bounds indices, and scrubs leaked XML/CDATA tags from model output before persisting records.',
    },
    {
      icon: <Zap className="w-5 h-5 text-[#2E6F5E]" />,
      title: 'Sub-Second Streaming & Low-Latency SLA',
      text: 'Real-time Server-Sent Events (SSE) stream tokens with under 200ms initial response time, delivering immediate feedback without holding server connections.',
    },
  ];

  return (
    <section id="security" className="py-20 lg:py-28 relative border-t border-[#DDD9CC] bg-[#ECE9DF]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs font-semibold mb-4">
            Enterprise Guardrails
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1B1F27] tracking-tight">
            Security, Compliance, and Cost Governance by Design
          </h2>
          <p className="text-[#5B6270] mt-4 text-base sm:text-lg">
            Built from the ground up to satisfy enterprise data protection standards and prevent AI security vulnerabilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {securityItems.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 border border-[#DDD9CC] shadow-[0_12px_36px_-20px_rgba(27,31,39,0.12)] hover:border-[#1B1F27] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#ECE9DF] flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="text-base font-bold text-[#1B1F27] mb-2">{item.title}</h3>
              <p className="text-xs text-[#5B6270] leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
