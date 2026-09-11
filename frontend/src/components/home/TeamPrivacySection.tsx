import React from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Users, 
  Lock, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  Database
} from 'lucide-react';

export const TeamPrivacySection: React.FC = () => {
  return (
    <section id="team-privacy" className="py-20 lg:py-28 relative border-t border-[#DDD9CC] bg-[#F6F5F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Team Privacy & Access Governance
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1B1F27] tracking-tight">
            Secure Member Invitations & Strict Role Boundaries
          </h2>
          <p className="text-[#5B6270] mt-4 text-base sm:text-lg leading-relaxed">
            Invite colleagues via cryptographically signed tokens, enforce granular multi-tenant permissions, and accelerate retrieval with enterprise-grade multi-layer caching.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Cryptographic Invitation Visual Card (7 Cols) */}
          <div className="lg:col-span-7 bg-[#FDFCFA] rounded-2xl border border-[#DDD9CC] p-6 sm:p-8 shadow-[0_12px_36px_-20px_rgba(27,31,39,0.12)] flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#DDD9CC]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1B1F27]">
                      Cryptographic Teammate Onboarding
                    </h3>
                    <p className="text-xs text-[#5B6270]">Zero-friction, tamper-proof email invitations</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[#2E6F5E] bg-[#2E6F5E]/10 px-2.5 py-1 rounded-full border border-[#2E6F5E]/20 font-semibold">
                  <Lock className="w-3 h-3" /> 64-char URL Token
                </span>
              </div>

              {/* Step-by-Step Flow */}
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC]">
                  <div className="w-6 h-6 rounded-full bg-[#1B1F27] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-[#1B1F27]">Admin Dispatches Invitation</div>
                    <p className="text-[#5B6270] leading-relaxed">
                      Admin inputs colleague's email (Gmail, Outlook, or corporate domain) and assigns an RBAC role (<span className="font-mono text-[#2E6F5E] font-bold">ADMIN</span>, <span className="font-mono text-[#2E6F5E] font-bold">MANAGER</span>, or <span className="font-mono text-[#2E6F5E] font-bold">EMPLOYEE</span>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC]">
                  <div className="w-6 h-6 rounded-full bg-[#2E6F5E] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-[#1B1F27]">Asynchronous Delivery via Celery Worker</div>
                    <p className="text-[#5B6270] leading-relaxed">
                      Celery background tasks generate a cryptographically unguessable token (`secrets.token_urlsafe(32)`) with 7-day auto-expiry and deliver a styled HTML invite to the recipient's inbox.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC]">
                  <div className="w-6 h-6 rounded-full bg-[#A9772F] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-[#1B1F27]">Atomic Single-Use Join & Instant Onboarding</div>
                    <p className="text-[#5B6270] leading-relaxed">
                      Invitee clicks the secure join link, verifies workspace context on a dedicated preview landing page, and joins seamlessly with atomic transaction safety.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Guarantee Callout */}
            <div className="p-3.5 rounded-xl bg-[rgba(46,111,94,0.08)] border border-[rgba(46,111,94,0.2)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#2E6F5E] font-medium">
                <Clock className="w-4 h-4 shrink-0" />
                <span>7-Day Auto-Expiration · Instant Token Revocation by Admins</span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#2E6F5E] shrink-0" />
            </div>
          </div>

          {/* Right: RBAC Hierarchy & Multi-Layer Caching (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            {/* RBAC Roles Summary Card */}
            <div className="bg-white rounded-2xl border border-[#DDD9CC] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#1B1F27]">
                <Users className="w-4 h-4 text-[#2E6F5E]" />
                <span>Role-Based Access Control (RBAC)</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1B1F27]">ADMIN</span>
                    <span className="text-[10px] font-mono text-[#2E6F5E] bg-[#2E6F5E]/10 px-2 py-0.5 rounded-full font-bold">Full Control</span>
                  </div>
                  <p className="text-[#5B6270]">
                    Manage team roster, send/revoke token invitations, upload documents, and adjust member access.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1B1F27]">MANAGER</span>
                    <span className="text-[10px] font-mono text-[#A9772F] bg-[#A9772F]/10 px-2 py-0.5 rounded-full font-bold">Knowledge Admin</span>
                  </div>
                  <p className="text-[#5B6270]">
                    Upload and re-index company policies, inspect vector chunks, and maintain knowledge freshness.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1B1F27]">EMPLOYEE</span>
                    <span className="text-[10px] font-mono text-[#1B1F27] bg-[#1B1F27]/10 px-2 py-0.5 rounded-full font-bold">Read & Query</span>
                  </div>
                  <p className="text-[#5B6270]">
                    Ask natural-language questions, search grounded knowledge, and view audit-proof citations.
                  </p>
                </div>
              </div>
            </div>

            {/* High-Performance Caching & Isolation Card */}
            <div className="bg-white rounded-2xl border border-[#DDD9CC] p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#1B1F27]">
                <Database className="w-4 h-4 text-[#A9772F]" />
                <span>Multi-Layer Caching & Isolation</span>
              </div>

              <div className="space-y-2 text-xs text-[#5B6270]">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#2E6F5E] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#1B1F27]">Redis Prompt TTL Caching (600s):</strong> Cached system prompts and templates deliver sub-second responses with infallible static fallback.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#2E6F5E] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#1B1F27]">Multi-Tenant Isolation:</strong> PostgreSQL schemas ensure queries, embeddings, and chat histories are completely isolated per workspace.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
