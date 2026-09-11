import React, { useState, useEffect, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  Database,
  MessageSquareText,
  Search,
  Bot,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Design tokens (aligned with homepage warm paper palette)
// ---------------------------------------------------------------------------
const COLOR = {
  bg: 'rgba(236, 233, 223, 0.5)',
  ink: '#1B1F27',
  green: '#2E6F5E',
  greenSoft: 'rgba(46,111,94,0.14)',
  amber: '#A9772F',
  amberSoft: 'rgba(169,119,47,0.14)',
  border: '#DDD9CC',
  muted: '#5B6270',
  card: '#FDFCFA',
  chip: '#ECE9DF',
};

// ---------------------------------------------------------------------------
// Node data — Carrying diagram coordinates & live trace details
// ---------------------------------------------------------------------------
const NODES = [
  {
    id: 0,
    step: '01',
    title: 'Upload documents',
    tag: 'DRF · SHA-256 dedup',
    userAction: 'Admins or managers drop policy PDFs, DOCX, Markdown or text files into a workspace.',
    howItWorks: 'Django REST Framework receives the file, hashes its content with SHA-256 to skip re-processing duplicates, and stores it on disk inside a tenant-isolated directory.',
    icon: UploadCloud,
    lane: 'index',
    x: 140,
    y: 120,
    exampleTitle: 'Document upload',
    exampleData: [
      { label: 'Endpoint', value: 'POST /api/v1/workspaces/<id>/documents/' },
      { label: 'Accepted types', value: '.pdf  .docx  .txt  .md' },
      { label: 'Dedup / storage', value: 'SHA-256 hash, tenant-isolated disk path' },
    ],
    metric: 'Requires Admin or Manager role',
  },
  {
    id: 1,
    step: '02',
    title: 'Parse & chunk',
    tag: 'Celery · recursive chunker',
    userAction: 'The file moves into the background — the page stays responsive.',
    howItWorks: 'A Celery worker picks a format-specific parser (pypdf, python-docx, Markdown, plain text), then a recursive character chunker splits the text on paragraph and sentence boundaries while keeping section headers and page numbers attached.',
    icon: FileSpreadsheet,
    lane: 'index',
    x: 460,
    y: 120,
    exampleTitle: 'Parsing & chunking',
    exampleData: [
      { label: 'Parsers', value: 'pypdf · python-docx · Markdown · Text' },
      { label: 'Chunker', value: 'Recursive character chunker, headers + page numbers kept' },
      { label: 'Status flow', value: 'PENDING → PROCESSING → COMPLETED / FAILED' },
    ],
    metric: 'Runs async, off the request thread',
  },
  {
    id: 2,
    step: '03',
    title: 'Generate embeddings',
    tag: 'FastEmbed · Gemini · OpenAI',
    userAction: 'Each chunk is converted into a vector representing its meaning.',
    howItWorks: 'A swappable embedding provider turns every chunk into a vector, so later search can match on meaning ("WFH" ≈ "remote work") rather than exact keywords.',
    icon: Sparkles,
    lane: 'index',
    x: 780,
    y: 120,
    exampleTitle: 'Embedding provider',
    exampleData: [
      { label: 'local / fastembed', value: 'BAAI/bge-small-en-v1.5 · 384d · 22–28ms · 281MB RAM' },
      { label: 'gemini', value: 'gemini-embedding-001 · 1536d' },
      { label: 'openai', value: 'text-embedding-3-small · 1536d' },
    ],
    metric: 'Local provider: zero API cost',
  },
  {
    id: 3,
    step: '04',
    title: 'Knowledge vault',
    tag: 'PostgreSQL 16 + pgvector',
    userAction: 'Every workspace’s knowledge lives in one shared database — but never crosses tenant lines.',
    howItWorks: 'Vectors are written to a pgvector HNSW cosine index. Every row carries a workspace_id, and every query is scoped to it, so one tenant can never retrieve another tenant’s chunks.',
    icon: Database,
    lane: 'hub',
    x: 1050,
    y: 320,
    exampleTitle: 'documents_embedding table',
    exampleData: [
      { label: 'Index', value: 'HNSW, cosine distance operator <=>' },
      { label: 'Isolation', value: 'Every row scoped to workspace_id' },
      { label: 'Dimension', value: 'Fixed per active embedding provider (384 or 1536)' },
    ],
    metric: 'Sub-second similarity lookup',
  },
  {
    id: 4,
    step: '05',
    title: 'Ask a question',
    tag: 'JWT / OAuth · rate limited',
    userAction: 'Any team member types a natural-language question into chat.',
    howItWorks: 'The request carries a SimpleJWT access token (or a Google OAuth-verified session) and is checked against a Redis sliding-window rate limiter before it reaches the model.',
    icon: MessageSquareText,
    lane: 'query',
    x: 140,
    y: 520,
    exampleTitle: 'Authenticated request',
    exampleData: [
      { label: 'Auth', value: 'SimpleJWT: 30-min access / 7-day refresh' },
      { label: 'Rate limit', value: '10 req/min per user · 60 req/min per workspace' },
      { label: 'Endpoint', value: 'POST /api/v1/conversations/<id>/messages/' },
    ],
    metric: 'Conversations capped at 50 messages',
  },
  {
    id: 5,
    step: '06',
    title: 'Semantic search',
    tag: 'pgvector cosine search',
    userAction: 'The system looks for the paragraphs that actually answer the question.',
    howItWorks: 'The question is embedded with the same provider used at ingestion, then compared against the vault using multi-tenant pgvector cosine similarity, filtered to the caller’s workspace_id.',
    icon: Search,
    lane: 'query',
    x: 460,
    y: 520,
    exampleTitle: 'Vector similarity search',
    exampleData: [
      { label: 'Scope', value: 'Filtered strictly to workspace_id' },
      { label: 'Also available at', value: 'POST /api/v1/workspaces/<id>/search/' },
      { label: 'Result', value: 'Top-k chunks ranked by cosine similarity' },
    ],
    metric: 'Same embedding model as ingestion',
  },
  {
    id: 6,
    step: '07',
    title: 'Stream the cited answer',
    tag: 'Gemini 3.1 Flash Lite · SSE',
    userAction: 'You read the answer as it’s written, with clickable citations back to the source.',
    howItWorks: 'The LLM streams tokens over Server-Sent Events. A citation validator then strips any [n] reference the model invents that doesn’t map to a real source, before the verified citations are saved.',
    icon: Bot,
    lane: 'query',
    x: 780,
    y: 520,
    exampleTitle: 'Streamed, validated response',
    exampleData: [
      { label: 'Stream events', value: 'metadata → token → citations → done' },
      { label: 'Citation check', value: 'Drops out-of-bounds [n] refs, strips stray XML' },
      { label: 'Typical latency', value: '~2.5s for a full grounded answer' },
    ],
    metric: 'Citations persisted to MessageSource',
  },
];

// Directed connections between nodes. `to` uses the *causal arrival* node,
// which is what lights an edge up as the flow reaches it.
const EDGES = [
  { id: 'e01', from: 0, to: 1 },
  { id: 'e12', from: 1, to: 2 },
  { id: 'e23', from: 2, to: 3 },
  { id: 'e45', from: 4, to: 5 },
  { id: 'e56', from: 5, to: 6 },
  // Cross-lane bridges — these are what make it read as an architecture diagram
  { id: 'lookup', from: 5, to: 3, bridge: true, activeAt: 5, label: 'semantic lookup' },
  { id: 'ground', from: 3, to: 6, bridge: true, activeAt: 6, label: 'grounds the citation' },
];

const VB_W = 1200;
const VB_H = 620;

function pct(v: number, total: number) {
  return `${(v / total) * 100}%`;
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  if (a.y === b.y) {
    // Same-lane connector: gentle upward bow so it still reads as a
    // flowing line rather than a ruler-straight connector.
    const bow = 30;
    return `M ${a.x} ${a.y} C ${a.x + dx * 0.35} ${a.y - bow}, ${a.x + dx * 0.65} ${b.y - bow}, ${b.x} ${b.y}`;
  }
  // Cross-lane bridge: smooth S-curve.
  return `M ${a.x} ${a.y} C ${a.x + dx * 0.55} ${a.y}, ${a.x + dx * 0.45} ${b.y}, ${b.x} ${b.y}`;
}

export const FlowVisualizationSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setActiveStep((p) => (p + 1) % NODES.length);
    }, 3400);
    return () => clearInterval(t);
  }, [isPlaying]);

  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);

  return (
    <section
      id="flow-visualization"
      style={{ backgroundColor: COLOR.bg, borderTop: `1px solid ${COLOR.border}` }}
      className="py-16 lg:py-24 relative"
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(${COLOR.border} 1px, transparent 1px)`, backgroundSize: '20px 20px' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6"
          style={{ borderBottom: `1px solid ${COLOR.border}` }}
        >
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ backgroundColor: COLOR.greenSoft, border: `1px solid rgba(46,111,94,0.25)`, color: COLOR.green }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLOR.green }} />
              <span>How it works under the hood</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight" style={{ color: COLOR.ink }}>
              From document to verified answer
            </h2>
            <p className="text-xs sm:text-sm mt-1.5 max-w-xl" style={{ color: COLOR.muted }}>
              One indexing pipeline builds the knowledge vault. One query pipeline reaches into it for every question.
            </p>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl self-start md:self-auto shadow-2xs"
            style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.border}` }}
          >
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{ backgroundColor: COLOR.ink, color: '#F6F5F0' }}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={() => {
                setActiveStep(0);
                setIsPlaying(true);
              }}
              className="p-1.5 rounded-lg cursor-pointer hover:bg-[#ECE9DF] transition-colors"
              style={{ color: COLOR.muted }}
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ================= DIAGRAM ================= */}
        <div
          className="rounded-2xl relative overflow-hidden shadow-sm"
          style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.border}` }}
        >
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: 880, aspectRatio: `${VB_W} / ${VB_H}` }}>
              {/* connector layer */}
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="absolute inset-0"
                style={{ width: '100%', height: '100%' }}
              >
                <defs>
                  <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill={COLOR.green} />
                  </marker>
                  <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill={COLOR.border} />
                  </marker>
                  <marker id="arrow-amber" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill={COLOR.amber} />
                  </marker>
                </defs>

                {/* lane labels */}
                <text x={140} y={44} fontSize="14" fontWeight="700" fill={COLOR.ink}>
                  Part 1 — Indexing (one-time, background)
                </text>
                <text x={140} y={444} fontSize="14" fontWeight="700" fill={COLOR.ink}>
                  Part 2 — Answering (live, every question)
                </text>

                {EDGES.map((e) => {
                  const a = byId[e.from];
                  const b = byId[e.to];
                  const d = edgePath(a, b);
                  const isBridge = !!e.bridge;
                  const traveled = isBridge ? activeStep >= e.activeAt : activeStep > e.from;
                  const isLive = isBridge ? activeStep === e.activeAt : activeStep === e.from;
                  const stroke = traveled ? (isBridge ? COLOR.amber : COLOR.green) : COLOR.border;
                  const marker = traveled ? (isBridge ? 'url(#arrow-amber)' : 'url(#arrow-green)') : 'url(#arrow-gray)';

                  // midpoint for the edge label
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2 + (isBridge ? 0 : -18);

                  return (
                    <g key={e.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={traveled ? 2.5 : 2}
                        strokeDasharray={isBridge || !traveled ? '2 7' : 'none'}
                        strokeLinecap="round"
                        markerEnd={marker}
                        style={{ transition: 'stroke 0.4s ease' }}
                      />
                      {isBridge && (
                        <text
                          x={mx}
                          y={my - 8}
                          fontSize="11"
                          fontWeight="600"
                          textAnchor="middle"
                          fill={traveled ? COLOR.amber : COLOR.muted}
                        >
                          {e.label}
                        </text>
                      )}
                      {isLive && (
                        <circle r="5" fill={isBridge ? COLOR.amber : COLOR.green}>
                          <animateMotion dur="1.6s" repeatCount="indefinite" path={d} />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* node layer */}
              {NODES.map((node) => {
                const Icon = node.icon;
                const isActive = activeStep === node.id;
                const isPast = activeStep > node.id && node.lane !== 'hub';
                const isHub = node.lane === 'hub';
                const size = isHub ? 96 : 76;
                const iconBox = isHub ? 38 : 30;

                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      setActiveStep(node.id);
                      setIsPlaying(false);
                    }}
                    className="absolute flex flex-col items-center cursor-pointer group"
                    style={{
                      left: pct(node.x, VB_W),
                      top: pct(node.y, VB_H),
                      transform: 'translate(-50%, -50%)',
                      width: 150,
                    }}
                  >
                    <div
                      className="rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        width: size,
                        height: size,
                        backgroundColor: isActive ? COLOR.greenSoft : isHub ? COLOR.chip : COLOR.card,
                        border: `2px solid ${isActive ? COLOR.green : isHub ? COLOR.ink : isPast ? '#C8C3B4' : COLOR.border}`,
                        boxShadow: isActive ? `0 0 0 6px ${COLOR.greenSoft}` : 'none',
                      }}
                    >
                      <Icon
                        style={{ width: iconBox, height: iconBox, color: isActive ? COLOR.green : isHub ? COLOR.ink : COLOR.muted }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <span
                      className="text-[9px] font-mono font-bold mt-1.5 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: isActive ? COLOR.green : COLOR.chip,
                        color: isActive ? '#fff' : COLOR.muted,
                      }}
                    >
                      {node.step}
                    </span>
                    <span
                      className="text-xs font-bold mt-1 text-center leading-tight"
                      style={{ color: COLOR.ink, maxWidth: 140 }}
                    >
                      {node.title}
                    </span>
                    <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: COLOR.amber }}>
                      {node.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-5 pb-3 lg:hidden text-center text-[11px]" style={{ color: COLOR.muted }}>
            Scroll sideways to see the full diagram →
          </div>

          {/* ================= INSPECTOR ================= */}
          {/* <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div
              className="lg:col-span-5 p-4 rounded-xl flex flex-col justify-between"
              style={{ backgroundColor: '#F6F5F0', border: `1px solid ${COLOR.border}` }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                    style={{ backgroundColor: COLOR.ink, color: '#F6F5F0' }}
                  >
                    STEP {activeNode.step}
                  </span>
                  <span className="text-xs font-bold" style={{ color: COLOR.ink }}>
                    {activeNode.title}
                  </span>
                  <span className="text-[10px] font-semibold font-mono" style={{ color: COLOR.amber }}>
                    ({activeNode.tag})
                  </span>
                </div>

                <div className="space-y-2 mt-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: COLOR.ink }}>
                      What happens
                    </span>
                    <p className="text-xs mt-0.5 leading-relaxed font-medium" style={{ color: COLOR.ink }}>
                      {activeNode.userAction}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: COLOR.muted }}>
                      Under the hood
                    </span>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: COLOR.muted }}>
                      {activeNode.howItWorks}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2.5 text-[11px]" style={{ borderTop: `1px solid ${COLOR.border}` }}>
                <div
                  className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.border}`, color: COLOR.ink }}
                >
                  <Zap className="w-3 h-3" style={{ color: COLOR.amber }} />
                  <span>{activeNode.metric}</span>
                </div>
              </div>
            </div>

            <div
              className="lg:col-span-7 rounded-xl p-4 flex flex-col justify-between"
              style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.border}` }}
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-3" style={{ borderBottom: `1px solid ${COLOR.chip}` }}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" style={{ color: COLOR.green }} />
                    <span className="text-xs font-bold" style={{ color: COLOR.ink }}>
                      {activeNode.exampleTitle}
                    </span>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: COLOR.greenSoft, color: COLOR.green }}
                  >
                    Live example
                  </span>
                </div>

                <div className="space-y-2">
                  {activeNode.exampleData.map((item, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs">
                      <span className="font-semibold shrink-0 sm:w-32 text-[11px]" style={{ color: COLOR.muted }}>
                        {item.label}
                      </span>
                      <span
                        className="font-medium px-2 py-1 rounded flex-1 text-[11px]"
                        style={{ color: COLOR.ink, backgroundColor: '#F6F5F0', border: `1px solid ${COLOR.chip}` }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2 flex items-center justify-between text-[11px]" style={{ borderTop: `1px solid ${COLOR.chip}`, color: COLOR.muted }}>
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" style={{ color: COLOR.green }} />
                  <span>Workspace-isolated, verified against source</span>
                </span>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  );
};

export default FlowVisualizationSection;
