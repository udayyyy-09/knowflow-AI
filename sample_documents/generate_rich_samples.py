import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_technical_spec_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1B1F27'),
        fontName='Helvetica-Bold',
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#5B6270'),
        fontName='Helvetica',
        spaceAfter=12
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#2E6F5E'),
        fontName='Helvetica-Bold',
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#2D3748'),
        fontName='Helvetica',
        spaceAfter=8
    )
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#2D3748'),
        fontName='Helvetica',
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    code_box_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1A202C'),
        fontName='Courier',
        spaceAfter=6
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("KnowFlow Core — Technical Architecture & Project Spec", title_style))
    story.append(Paragraph("<b>Document Code:</b> SPEC-ENG-2026-v4 &nbsp;|&nbsp; <b>Classification:</b> Core Platform Engineering &nbsp;|&nbsp; <b>Status:</b> Approved for Production", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2E6F5E'), spaceAfter=14))

    # Section 1
    story.append(Paragraph("1. System Overview & Engineering Objectives", h2_style))
    story.append(Paragraph(
        "KnowFlow AI is a high-throughput, multi-tenant Retrieval-Augmented Generation (RAG) platform. "
        "The system delivers sub-200ms Time-To-First-Token (TTFT) across millions of indexed enterprise documents while "
        "enforcing strict tenant-level cryptographic data isolation across PostgreSQL, Redis, and vector search indices.",
        body_style
    ))

    # SLO Table
    slo_data = [
        [Paragraph("<b>Metric / SLO</b>", body_style), Paragraph("<b>Target Threshold</b>", body_style), Paragraph("<b>Production Enforcement</b>", body_style)],
        [Paragraph("P95 Vector Search Latency", body_style), Paragraph("&lt; 45ms", body_style), Paragraph("PostgreSQL 16 pgvector HNSW (m=16, ef=64)", body_style)],
        [Paragraph("P99 Streaming TTFT", body_style), Paragraph("&lt; 350ms", body_style), Paragraph("Multi-Tier Cascading LLM failover protocol", body_style)],
        [Paragraph("Multi-Tenant Isolation", body_style), Paragraph("100% Cryptographic", body_style), Paragraph("Workspace UUID partitioning at DB & cache layer", body_style)],
        [Paragraph("System Availability", body_style), Paragraph("99.95% Uptime", body_style), Paragraph("Dual-region active-passive worker failover", body_style)],
    ]
    t = Table(slo_data, colWidths=[150, 100, 250])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FAF9F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1B1F27')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDD9CC')),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # Section 2
    story.append(Paragraph("2. Microservices Topology & Distributed Ingestion Pipeline", h2_style))
    story.append(Paragraph(
        "The KnowFlow platform decouples interactive query execution from asynchronous document parsing through a resilient Celery worker fleet:",
        body_style
    ))
    story.append(Paragraph("• <b>Ingestion Engine:</b> Supports PDF (PyMuPDF/Unstructured), Word DOCX, Markdown, and TXT formats with automatic MIME verification.", bullet_style))
    story.append(Paragraph("• <b>Deterministic Chunking:</b> 500-token sliding window with 100-token overlap, preserving semantic heading hierarchies.", bullet_style))
    story.append(Paragraph("• <b>Vector Embedding:</b> 768-dimensional dense vector embeddings generated via Google Gemini / Hugging Face models.", bullet_style))
    story.append(Paragraph("• <b>Asynchronous Task Queue:</b> Redis 7 acts as the broker with exponential backoff retry (max 3 attempts).", bullet_style))

    # Section 3
    story.append(Paragraph("3. Multi-Tier LLM Cascading & Automatic Failover", h2_style))
    story.append(Paragraph(
        "To achieve zero-downtime streaming inference against third-party rate limits (HTTP 429) or upstream outages (HTTP 503), the LLM executor evaluates a three-tier cascade:",
        body_style
    ))
    story.append(Paragraph("1. <b>Tier 1 (Primary):</b> Groq Cloud (Qwen 3.8-27B / Compound-Mini) for ultra-low latency &lt; 200ms TTFT.", bullet_style))
    story.append(Paragraph("2. <b>Tier 2 (Secondary):</b> Google Gemini (Gemini Flash Lite) for complex multi-page synthesis.", bullet_style))
    story.append(Paragraph("3. <b>Tier 3 (Tertiary):</b> Hugging Face Serverless Inference (Llama 3.1 8B Instruct).", bullet_style))

    # Section 4
    story.append(Paragraph("4. Security, Cryptography & Role-Based Access Control (RBAC)", h2_style))
    story.append(Paragraph(
        "KnowFlow implements strict defense-in-depth isolation: workspace memberships are verified via JWT bearer tokens and evaluated against three RBAC roles (ADMIN, MANAGER, EMPLOYEE). "
        "Workspace invitation tokens are generated using 32-byte cryptographic random entropy (secrets.token_urlsafe) and stored as SHA-256 hashes.",
        body_style
    ))

    doc.build(story)
    print(f"Generated: {output_path}")

def generate_company_policy_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1B1F27'),
        fontName='Helvetica-Bold',
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#5B6270'),
        fontName='Helvetica',
        spaceAfter=12
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#A9772F'),
        fontName='Helvetica-Bold',
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#2D3748'),
        fontName='Helvetica',
        spaceAfter=8
    )
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#2D3748'),
        fontName='Helvetica',
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    story = []

    story.append(Paragraph("Acme Corp — Enterprise Security & Compliance Policy (2026)", title_style))
    story.append(Paragraph("<b>Version:</b> 2026.2 &nbsp;|&nbsp; <b>Classification:</b> Mandatory Corporate Policy &nbsp;|&nbsp; <b>Applies To:</b> All Employees & Contractors", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#A9772F'), spaceAfter=14))

    story.append(Paragraph("1. Authentication, Password Complexity & MFA", h2_style))
    story.append(Paragraph("• <b>Multi-Factor Authentication (MFA):</b> Mandatory across all corporate Google Workspace, GitHub, and production AWS/database accounts.", bullet_style))
    story.append(Paragraph("• <b>Password Requirements:</b> Minimum 14 characters containing uppercase, lowercase, numbers, and symbols.", bullet_style))
    story.append(Paragraph("• <b>Password Rotation:</b> Passwords must be refreshed every 90 days. Reusing the previous 5 passwords is prohibited.", bullet_style))

    story.append(Paragraph("2. Data Classification & Protection", h2_style))
    story.append(Paragraph("• <b>Confidential Data:</b> Customer PII, encryption keys, and proprietary source code must never be stored on unencrypted local drives.", bullet_style))
    story.append(Paragraph("• <b>Production Data Export:</b> Exporting production database dumps to personal devices is strictly prohibited.", bullet_style))
    story.append(Paragraph("• <b>Sanitization:</b> Staging and development environments must use anonymized, synthetic test data.", bullet_style))

    story.append(Paragraph("3. Incident Response & Security Escalation", h2_style))
    story.append(Paragraph("• Any lost, stolen, or compromised device must be reported to <b>security@acme.corp</b> within 2 hours of discovery.", bullet_style))
    story.append(Paragraph("• Security incident response teams will immediately revoke active sessions and trigger remote device wiping.", bullet_style))

    doc.build(story)
    print(f"Generated: {output_path}")

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, '..', 'frontend', 'public', 'sample_documents')
    os.makedirs(frontend_dir, exist_ok=True)

    # 1. Technical Project PDF
    generate_technical_spec_pdf(os.path.join(base_dir, 'technical_team_project.pdf'))
    generate_technical_spec_pdf(os.path.join(frontend_dir, 'technical_team_project.pdf'))

    # 2. Company Policy PDF
    generate_company_policy_pdf(os.path.join(base_dir, 'company_policy.pdf'))
    generate_company_policy_pdf(os.path.join(frontend_dir, 'company_policy.pdf'))
