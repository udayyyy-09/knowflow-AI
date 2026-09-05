"""
Generates dummy test files: company_policy.pdf, handbook.docx, company_leave_policy.txt, security_guidelines.md
"""
import os

def create_raw_pdf(filepath, title, content_lines):
    """
    Creates a minimal valid standard PDF file containing text.
    """
    # Build text stream
    text_stream = f"BT\n/F1 18 Tf\n50 750 Td\n({title}) Tj\n/F1 12 Tf\n0 -30 Td\n"
    for line in content_lines:
        safe_line = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        text_stream += f"({safe_line}) Tj\n0 -18 Td\n"
    text_stream += "ET"

    stream_len = len(text_stream.encode('latin1'))

    pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length {stream_len} >>
stream
{text_stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000300 + stream_len 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
500
%%EOF"""

    with open(filepath, 'wb') as f:
        f.write(pdf_content.encode('latin1'))


def create_sample_docx(filepath, title, content_lines):
    """
    Creates a simple zipped DOCX document structure with document.xml.
    """
    import zipfile
    import xml.sax.saxutils as saxutils

    doc_xml_body = f'<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>{saxutils.escape(title)}</w:t></w:r></w:p>'
    for line in content_lines:
        doc_xml_body += f'<w:p><w:r><w:t>{saxutils.escape(line)}</w:t></w:r></w:p>'

    doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        {doc_xml_body}
    </w:body>
</w:document>'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', content_types)
        zf.writestr('_rels/.rels', rels)
        zf.writestr('word/document.xml', doc_xml)


if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # 1. company_policy.pdf
    pdf_path = os.path.join(base_dir, 'company_policy.pdf')
    create_raw_pdf(
        pdf_path,
        "Acme Corp - Enterprise Security & Data Policy (2026)",
        [
            "1. Multi-Factor Authentication (MFA) is mandatory for all employee accounts.",
            "2. Production databases must never be exported to unencrypted local devices.",
            "3. Passwords must be at least 12 characters and rotated every 90 days.",
            "4. Lost or stolen laptops must be reported to IT Security within 2 hours.",
            "5. Customer PII must be masked in staging and development environments."
        ]
    )
    print(f"Created: {pdf_path}")

    # 2. handbook.docx
    docx_path = os.path.join(base_dir, 'handbook.docx')
    create_sample_docx(
        docx_path,
        "Acme Corp - Employee Handbook & Benefits 2026",
        [
            "Welcome to Acme Corp! This handbook covers all company benefits and standard procedures.",
            "Health Care: Comprehensive dental, medical, and vision insurance begins on Day 1 of employment.",
            "Learning & Development: Every employee is allocated a $1,500 annual budget for courses and books.",
            "Office Hours: Core collaboration hours are 10:00 AM to 4:00 PM local time.",
            "Wellness Benefit: Monthly $100 gym and wellness subsidy claimable via payroll."
        ]
    )
    print(f"Created: {docx_path}")
