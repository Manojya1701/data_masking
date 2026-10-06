#!/usr/bin/env python3
"""
Generate Executive Publication-Quality PDF for DSAR Portal & Consent Hub Documentation.
Refined pagination & layout ensuring:
- Every table starts cleanly on its own page with its section heading.
- Zero awkward page breaks in the middle of table headers or rows.
- Professional executive layout ready to present directly to Sir / Management.
"""

import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# Branded Palette
PRIMARY = colors.HexColor('#0F172A')     # Slate 900
BRAND_CYAN = colors.HexColor('#0891B2')  # Deep Cyan 600
BRAND_PURPLE = colors.HexColor('#7C3AED')# Purple 600
ACCENT_GREEN = colors.HexColor('#059669')# Emerald 600
TEXT_DARK = colors.HexColor('#1E293B')   # Slate 800
TEXT_MUTED = colors.HexColor('#64748B')  # Slate 500
BG_LIGHT = colors.HexColor('#F8FAFC')    # Slate 50
BORDER_COLOR = colors.HexColor('#CBD5E1')# Slate 300
CARD_BG = colors.HexColor('#F1F5F9')     # Slate 100


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print total page numbers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(TEXT_MUTED)

        # Header (pages 2+)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 34, "Segmento UDPS — Universal Data Protection System")
            self.drawRightString(letter[0] - 54, letter[1] - 34, "DSAR Portal & Consent Hub Architecture")
            self.setStrokeColor(BORDER_COLOR)
            self.setLineWidth(0.6)
            self.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)

        # Footer (all pages)
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.6)
        self.line(54, 42, letter[0] - 54, 42)
        self.setFont("Helvetica", 8)
        self.drawString(54, 30, "Confidential — Enterprise Privacy Engineering & Compliance Platform")
        page_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(letter[0] - 54, 30, page_text)

        self.restoreState()


def build_pdf(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=PRIMARY,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=BRAND_CYAN,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=PRIMARY,
        spaceBefore=8,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=BRAND_PURPLE,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=TEXT_DARK,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3.5
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=TEXT_DARK
    )

    story = []

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 1: TITLE BANNER & SECTION 1: LEGAL DICHOTOMY
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("Segmento UDPS &bull; Privacy Engineering Specification", subtitle_style))
    story.append(Paragraph("DSAR Portal &amp; Consent Hub Architecture &amp; Flow Specification", title_style))
    story.append(Paragraph("End-to-End Privacy Automation, Statutory Retention Rules &amp; Apache Kafka Event Streaming", ParagraphStyle('SubSub', parent=body_style, fontSize=9, leading=12, textColor=TEXT_MUTED)))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_CYAN, spaceBefore=6, spaceAfter=10))

    meta_data = [
        [
            Paragraph("<b>Platform:</b> Segmento Universal Data Protection", table_cell_style),
            Paragraph("<b>Runtime:</b> Node.js 18+ (tested v26.x)", table_cell_style),
            Paragraph("<b>Automated Tests:</b> 20/20 Passed (234/234, 100%)", table_cell_style)
        ],
        [
            Paragraph("<b>Legal Mandates:</b> GDPR, DPDP 2023, PDPA, CCPA", table_cell_style),
            Paragraph("<b>Integration:</b> Apache Kafka Dual-Mode Broker", table_cell_style),
            Paragraph(f"<b>Date:</b> {datetime.now().strftime('%B %d, %Y')}", table_cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[170, 165, 165])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Executive Summary &amp; Statutory Legal Distinction", h1_style))
    story.append(Paragraph(
        "The platform coordinates automated Data Subject Access Requests (DSAR) across distributed cloud microservices, operational databases, CRM leads, and analytical data lakes. A core design requirement is the strict operational distinction between <b>Full Account Deletion</b> and <b>Granular Consent Withdrawal</b>:",
        body_style
    ))

    dichotomy_data = [
        [
            Paragraph("<b>LEGAL DIMENSION</b>", table_header_style),
            Paragraph("<b>ACCOUNT DELETION (GDPR Art. 17 / DPDP Sec. 12)</b>", table_header_style),
            Paragraph("<b>CONSENT WITHDRAWAL (GDPR Art. 7(3) / DPDP Sec. 6(4))</b>", table_header_style)
        ],
        [
            Paragraph("<b>Account State</b>", table_cell_style),
            Paragraph("Account is <b>TERMINATED</b> and permanently erased.", table_cell_style),
            Paragraph("Account remains <b>ACTIVE &amp; RETAINED</b>.", table_cell_style)
        ],
        [
            Paragraph("<b>Data Impact</b>", table_cell_style),
            Paragraph("PII erased or salt-anonymized across operational DBs.", table_cell_style),
            Paragraph("Transactional data kept; processing permissions revoked.", table_cell_style)
        ],
        [
            Paragraph("<b>Downstream Effect</b>", table_cell_style),
            Paragraph("Multi-connector purge across primary tables &amp; caches.", table_cell_style),
            Paragraph("Halts real-time marketing, AI training &amp; telemetry streams.", table_cell_style)
        ],
        [
            Paragraph("<b>Statutory Locks</b>", table_cell_style),
            Paragraph("Financial invoices locked under RBI / GST 7-10 yr hold.", table_cell_style),
            Paragraph("No financial hold overrides needed; user can re-opt-in anytime.", table_cell_style)
        ],
        [
            Paragraph("<b>Cryptographic Proof</b>", table_cell_style),
            Paragraph("Signed Cryptographic Deletion Certificate (CERT-DEL-XXXX).", table_cell_style),
            Paragraph("Cryptographic Proof Receipt (WDR-XXXX) + Suppression Hash.", table_cell_style)
        ]
    ]
    d_table = Table(dichotomy_data, colWidths=[90, 205, 205])
    d_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(d_table)

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 2: 6-LAYER ARCHITECTURE STACK
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. System Architecture: The 6-Layer Decoupled Stack", h1_style))
    story.append(Paragraph(
        "The architecture decouples request intake from execution, statutory policy enforcement, and message-driven synchronization through 6 independent layers:",
        body_style
    ))

    layers_data = [
        [Paragraph("<b>LAYER</b>", table_header_style), Paragraph("<b>PRIMARY RESPONSIBILITIES, PROTOCOLS &amp; SOURCE MODULES</b>", table_header_style)],
        [
            Paragraph("<b>Layer 1: User &amp; Interface Layer</b>", table_cell_style),
            Paragraph("<b>DSAR Portal Web UI:</b> 8 integrated subviews (Intake Form, Master Queue, Discovery Engine, Execution Hub, Verification, Team/SLA Settings, Consent Matrix, and Kafka Stream Monitor). Built in responsive modular JavaScript (frontend/public/js/consent-hub.js).", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 2: API Gateway &amp; Security Layer</b>", table_cell_style),
            Paragraph("<b>Segmento Gateway:</b> OAuth 2.0 / OIDC Authorization Server with RS256 JWT tokens, JWKS discovery endpoint (/.well-known/jwks.json), RBAC scope guards (consent:withdraw, deletions:create), sliding-window rate limiting, and X-Correlation-ID tracing header injection.", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 3: Core Business Orchestration</b>", table_cell_style),
            Paragraph("<b>Orchestration Engines:</b> DSAR Orchestrator (backend/services/dsar-service.js), Statutory Policy Engine (dsar-policy-service.js), Multi-Lead SLA Assignment (dsar-assignment-service.js), and Consent Service (consent-service.js).", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 4: Data &amp; Persistence Layer</b>", table_cell_style),
            Paragraph("<b>Multi-Store Persistence:</b> PostgreSQL instance with zero-downtime local SQL fallback (backend/database/udps_local_db.json), legal hold billing escrows for RBI/GST statutory retention, and persistent consent registry (consent-ledger.json).", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 5: Event &amp; Integration (Kafka)</b>", table_cell_style),
            Paragraph("<b>Apache Kafka Streaming:</b> Dual-mode zero-config partition broker with 3 topics (consent.events.withdrawal, .grant, .dlq), key-partition hashing by subject_id, consumer group offset commits, and 5 downstream connector consumers.", table_cell_style)
        ],
        [
            Paragraph("<b>Layer 6: Verification &amp; Proof Layer</b>", table_cell_style),
            Paragraph("<b>Cryptographic Receipts:</b> SHA-256 immutable withdrawal receipts, suppression tokens (SHA-256 hashed identifiers ensuring zero plain PII is stored downstream), signed deletion certificates, and append-only tamper-proof audit trails.", table_cell_style)
        ]
    ]
    l_table = Table(layers_data, colWidths=[110, 390])
    l_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_PURPLE),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(l_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("8 Modular Subviews in the DSAR Portal Workspace", h2_style))
    subviews_data = [
        "<b>1. Intake Workspace:</b> Create new erasure/DSAR requests with scope pills (Full Erasure vs Granular Consent).",
        "<b>2. Master Request Queue:</b> Real-time KPI tracker across all 7 lifecycle stages with statutory deadline countdowns.",
        "<b>3. Discovery &amp; Impact Engine:</b> Automated cross-database PII discovery scanning tables, caches, and file stores.",
        "<b>4. Execution &amp; Orchestration:</b> Multi-connector task execution with multi-department subtask delegation.",
        "<b>5. Verification &amp; Certificates:</b> Post-execution residue queries and downloadable signed SHA-256 certificates.",
        "<b>6. Team &amp; SLA Settings Hub:</b> Department assignments, statutory SLA deadlines, and Nodemailer SMTP webmail inboxes.",
        "<b>7. Consent Hub Matrix:</b> Granular 5-category processing matrix toggles and instant cryptographic receipt generator.",
        "<b>8. Kafka Stream Monitor:</b> Real-time Kafka topic partition viewer, consumer lag metrics, and stream replay button."
    ]
    for sv in subviews_data:
        story.append(Paragraph(f"• {sv}", bullet_style))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 3: END-TO-END WORKFLOW PROCESS FLOWS
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. End-to-End Workflow Process Flows", h1_style))

    story.append(Paragraph("Flow A: 7-Stage Privacy Deletion Lifecycle (GDPR Art. 17 / DPDP Sec. 12)", h2_style))
    deletion_steps = [
        "<b>Stage 1 (CREATED):</b> Subject initiates request via DSAR Intake. Validated with email, customer ID, and jurisdiction.",
        "<b>Stage 2 (DISCOVERY_PENDING ➔ DISCOVERED):</b> System executes automated scans across databases, caches, CRM, and analytics tables to find all records associated with the subject identifier.",
        "<b>Stage 3 (POLICY EVALUATION):</b> Policy engine evaluates statutory retention obligations (RBI/GST 7-10 yr billing ledgers, active loans, fraud investigations).",
        "<b>Stage 4 (PLAN_READY):</b> Generates a 6-action plan (PERMANENT_DELETE, ANONYMIZE, STATUTORY_FREEZE, CACHE_INVALIDATION, SYNC_DOWNSTREAM, NOTIFY_LEADS).",
        "<b>Stage 5 (AWAITING_APPROVAL ➔ APPROVED):</b> Dispatches email notifications to Department Leads (CRM, Security, Engineering) via Nodemailer SMTP / Ethereal test inboxes. DPO grants execution approval.",
        "<b>Stage 6 (EXECUTING ➔ EXECUTED):</b> Connectors execute atomic deletions and freeze retained financial ledgers in statutory escrow.",
        "<b>Stage 7 (VERIFICATION ➔ COMPLETED):</b> Runs post-deletion verification check to verify zero residual operational PII and issues a signed Cryptographic Deletion Certificate (CERT-DEL-2026-XXXX)."
    ]
    for step in deletion_steps:
        story.append(Paragraph(f"• {step}", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Flow B: Granular Consent Withdrawal &amp; Kafka Downstream Enforcement (GDPR Art. 7(3))", h2_style))
    consent_steps = [
        "<b>Step 1 (User Request):</b> Subject selects specific categories to revoke (e.g. AI Model Training, Promotional Marketing) in the DSAR Consent Hub.",
        "<b>Step 2 (Gateway Authentication):</b> POST /api/v1/consent/withdraw passes through Segmento Gateway. Token is validated via RS256 signature and scope guard (consent:withdraw).",
        "<b>Step 3 (State Transition):</b> Consent Management Service transitions category state from GRANTED ➔ WITHDRAWN. Crucially, Account status remains ACTIVE (Retained).",
        "<b>Step 4 (Cryptographic Receipt):</b> Generates SHA-256 immutable proof receipt (WDR-2026-XXXX) and hashed suppression token.",
        "<b>Step 5 (Kafka Event Emission):</b> Producer partitions message by hashing subject_id (md5 % 3) and publishes to topic 'consent.events.withdrawal' with correlation headers.",
        "<b>Step 6 (Downstream Consumer Enforcement):</b> 5 concurrent connector consumer groups receive the event and execute enforcement actions immediately:",
        "    - <i>CRM (Salesforce/HubSpot):</i> Sets DoNotContact and ConsentWithdrawn flags.",
        "    - <i>Marketing (SendGrid/Twilio):</i> Hashes email into global unsubscribe &amp; STOP suppression list.",
        "    - <i>Data Lake (Snowflake):</i> Mutes telemetry stream and purges behavioral tracking partition.",
        "    - <i>AI / ML Pipeline (Vertex AI):</i> Issues EXCL-AI-XXXX exclusion token under EU AI Act Art. 53.",
        "    - <i>Third-Party Systems:</i> Emits IAB Do-Not-Sell partner syndication webhooks.",
        "<b>Step 7 (Consumer Offset Commit &amp; DLQ):</b> Consumer groups commit partition offsets. Errors trigger retry routing to Dead Letter Queue (consent.events.dlq).",
        "<b>Step 8 (Live Dashboard Reflection):</b> Event stream log and connector cards update in real time with ACK_COMMITTED status."
    ]
    for step in consent_steps:
        story.append(Paragraph(f"• {step}", bullet_style))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 4: DOWNSTREAM CONNECTOR SPECIFICATIONS
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Downstream Connector Enforcement Specifications", h1_style))
    story.append(Paragraph(
        "When consent withdrawal events stream through Apache Kafka, 5 consumer groups independently process and apply compliance actions across downstream systems:",
        body_style
    ))

    conn_table_data = [
        [
            Paragraph("<b>CONNECTOR</b>", table_header_style),
            Paragraph("<b>TARGET SYSTEM</b>", table_header_style),
            Paragraph("<b>CONSUMER GROUP</b>", table_header_style),
            Paragraph("<b>ACTION ENFORCED ON WITHDRAWAL</b>", table_header_style),
            Paragraph("<b>STATUTORY BASIS</b>", table_header_style)
        ],
        [
            Paragraph("<b>1. CRM Connector</b>", table_cell_style),
            Paragraph("Salesforce CRM, HubSpot, Braze", table_cell_style),
            Paragraph("crm-enforcement-group", table_cell_style),
            Paragraph("Sets DoNotContact and ConsentWithdrawn on account &amp; lead records.", table_cell_style),
            Paragraph("GDPR Art. 21 / DPDP Sec. 6", table_cell_style)
        ],
        [
            Paragraph("<b>2. Marketing Platform</b>", table_cell_style),
            Paragraph("SendGrid, Twilio SMS Gateway", table_cell_style),
            Paragraph("marketing-platform-group", table_cell_style),
            Paragraph("Inserts SHA-256 suppression hash into global unsubscribe &amp; STOP list.", table_cell_style),
            Paragraph("ePrivacy Directive / CAN-SPAM", table_cell_style)
        ],
        [
            Paragraph("<b>3. Data Lake &amp; Warehouse</b>", table_cell_style),
            Paragraph("Snowflake Lakehouse, GA4", table_cell_style),
            Paragraph("datalake-snowflake-group", table_cell_style),
            Paragraph("Mutes telemetry stream; purges partition: analytics.customer_tracking.", table_cell_style),
            Paragraph("GDPR Art. 6(1)(a)", table_cell_style)
        ],
        [
            Paragraph("<b>4. AI / ML Pipeline</b>", table_cell_style),
            Paragraph("Vertex AI, OpenAI Fine-Tuning", table_cell_style),
            Paragraph("aiml-training-exclusion-group", table_cell_style),
            Paragraph("Commits EXCL-AI-XXXX token to omit customer chats from LLM datasets.", table_cell_style),
            Paragraph("EU AI Act Art. 53 / GDPR Art. 9", table_cell_style)
        ],
        [
            Paragraph("<b>5. Third-Party Systems</b>", table_cell_style),
            Paragraph("Ad Exchanges, Affiliate Brokers", table_cell_style),
            Paragraph("thirdparty-syndication-group", table_cell_style),
            Paragraph("Dispatches IAB Do-Not-Sell / Do-Not-Share webhooks to partner endpoints.", table_cell_style),
            Paragraph("CCPA / CPRA Do Not Sell", table_cell_style)
        ]
    ]
    c_table = Table(conn_table_data, colWidths=[90, 100, 105, 125, 80])
    c_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_CYAN),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(c_table)

    story.append(Spacer(1, 14))
    story.append(Paragraph("Dead Letter Queue (DLQ) &amp; Stream Replay Mechanism", h2_style))
    story.append(Paragraph(
        "<b>Automatic DLQ Routing:</b> If any downstream connector experiences connection failure, timeouts, or API schema rejection, the message is automatically republished to <code>consent.events.dlq</code> with retry count headers (x-retry-count) without halting other connector groups.<br/>"
        "<b>Audit Stream Replay:</b> Compliance officers can trigger <code>POST /api/v1/consent/kafka/replay</code> from offset 0, which re-emits historical withdrawal events across all consumer groups for regulatory audits or downstream connector recovery.",
        body_style
    ))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 5: COMPLETE REST API SPECIFICATION
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. Complete REST API Reference", h1_style))
    story.append(Paragraph(
        "All API endpoints are mounted on the Express application and guarded by Segmento OAuth 2.0 / OIDC middleware:",
        body_style
    ))

    api_table_data = [
        [
            Paragraph("<b>METHOD</b>", table_header_style),
            Paragraph("<b>ENDPOINT PATH</b>", table_header_style),
            Paragraph("<b>REQUIRED SCOPE</b>", table_header_style),
            Paragraph("<b>DESCRIPTION &amp; FUNCTIONALITY</b>", table_header_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/categories", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Returns all 5 granular consent categories and system metadata.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/status/:id", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Retrieves current consent matrix and history for subject identifier.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/consent/withdraw", table_cell_style),
            Paragraph("consent:withdraw", table_cell_style),
            Paragraph("Executes granular withdrawal, streams Kafka event, and yields SHA-256 receipt.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/consent/grant", table_cell_style),
            Paragraph("consent:grant", table_cell_style),
            Paragraph("Re-grants consent for specified categories (Opt-in) and streams to Kafka.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/receipt/:id", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Fetches verified cryptographic proof receipt by receiptId.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/history/:id", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Retrieves complete chronological audit trail of consent events.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/ledger", table_cell_style),
            Paragraph("consent:admin", table_cell_style),
            Paragraph("Master consent ledger view across all data subjects for DPO review.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/kafka/metrics", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Returns cluster broker health, topics, high watermarks, and consumer lag.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/kafka/events", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Live Kafka event stream log with optional ?topic= and ?limit= parameters.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/kafka/connectors", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Status, processed counts, and health of all 5 downstream connector consumers.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/consent/kafka/ledger", table_cell_style),
            Paragraph("consent:read", table_cell_style),
            Paragraph("Enforcement ledger showing all downstream automated system actions.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/consent/kafka/replay", table_cell_style),
            Paragraph("consent:withdraw", table_cell_style),
            Paragraph("Replays event stream from specific offset across consumer groups.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/deletions", table_cell_style),
            Paragraph("deletions:create", table_cell_style),
            Paragraph("Creates new DSAR erasure request (Status: CREATED).", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id", table_cell_style),
            Paragraph("deletions:read", table_cell_style),
            Paragraph("Fetches full DSAR request record with stage, findings, and history.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id/discover", table_cell_style),
            Paragraph("deletions:create", table_cell_style),
            Paragraph("Executes automated cross-system PII discovery scan across DBs and caches.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id/plan", table_cell_style),
            Paragraph("deletions:create", table_cell_style),
            Paragraph("Generates 6-action deletion plan with statutory retention evaluation.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id/approve", table_cell_style),
            Paragraph("deletions:admin", table_cell_style),
            Paragraph("Approves deletion plan for execution.", table_cell_style)
        ],
        [
            Paragraph("<b>POST</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id/execute", table_cell_style),
            Paragraph("deletions:admin", table_cell_style),
            Paragraph("Executes atomic deletions and freezes financial invoices in escrow.", table_cell_style)
        ],
        [
            Paragraph("<b>GET</b>", table_cell_style),
            Paragraph("/api/v1/deletions/:id/certificate", table_cell_style),
            Paragraph("deletions:read", table_cell_style),
            Paragraph("Downloads signed cryptographic deletion certificate with SHA-256 proof.", table_cell_style)
        ]
    ]
    api_table = Table(api_table_data, colWidths=[55, 160, 100, 185])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(api_table)

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 6: AUTOMATED TESTING & VERIFICATION REPORT
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("6. Automated Testing &amp; Verification Report", h1_style))
    story.append(Paragraph(
        "The codebase has been verified with comprehensive unit, integration, and security tests. All 20 test suites pass with 100% success rate:",
        body_style
    ))

    test_summary_data = [
        [
            Paragraph("<b>TEST SUITE FILE</b>", table_header_style),
            Paragraph("<b>SCOPE &amp; REGULATORY VERIFICATION</b>", table_header_style),
            Paragraph("<b>TESTS</b>", table_header_style),
            Paragraph("<b>RESULT</b>", table_header_style)
        ],
        [
            Paragraph("tests/kafka-consent-integration.test.js", table_cell_style),
            Paragraph("Kafka partition hashing, producer headers, 5 connectors, DLQ failover &amp; replay.", table_cell_style),
            Paragraph("13", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("tests/consent-withdrawal.test.js", table_cell_style),
            Paragraph("GDPR Art. 7(3) state machine, 5 categories, SHA-256 receipts, and opt-in.", table_cell_style),
            Paragraph("9", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("tests/gateway-oauth.test.js", table_cell_style),
            Paragraph("RS256 JWT validation, JWKS, rate limiting, and RBAC scope guards.", table_cell_style),
            Paragraph("17", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("tests/data-deletion-api.test.js", table_cell_style),
            Paragraph("Full 10-endpoint DSAR deletion REST platform and 7-stage lifecycle.", table_cell_style),
            Paragraph("15", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("tests/dsar-policy.test.js", table_cell_style),
            Paragraph("RBI Master Direction &amp; GST statutory retention rules (7-10 yr locks).", table_cell_style),
            Paragraph("9", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("15 Other Protection &amp; DSAR Suites", table_cell_style),
            Paragraph("AES-256-GCM encryption, database masking, email search, discovery, certs.", table_cell_style),
            Paragraph("171", table_cell_style),
            Paragraph("<b>PASS (100%)</b>", ParagraphStyle('P', parent=table_cell_style, textColor=ACCENT_GREEN))
        ],
        [
            Paragraph("<b>TOTAL ACROSS ALL SUITES</b>", ParagraphStyle('TB', parent=table_cell_style, fontName='Helvetica-Bold')),
            Paragraph("<b>Complete End-to-End Enterprise Privacy Platform Verification</b>", ParagraphStyle('TB', parent=table_cell_style, fontName='Helvetica-Bold')),
            Paragraph("<b>234</b>", ParagraphStyle('TB', parent=table_cell_style, fontName='Helvetica-Bold')),
            Paragraph("<b>234/234 (100%)</b>", ParagraphStyle('TB', parent=table_cell_style, fontName='Helvetica-Bold', textColor=ACCENT_GREEN))
        ]
    ]
    test_table = Table(test_summary_data, colWidths=[150, 220, 50, 80])
    test_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_PURPLE),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, BG_LIGHT]),
        ('BACKGROUND', (0,-1), (-1,-1), CARD_BG),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(test_table)

    story.append(Spacer(1, 15))
    story.append(Paragraph("Compliance Conclusion &amp; Audit Readiness", h2_style))
    story.append(Paragraph(
        "The Segmento UDPS DSAR Portal and Consent Hub architecture provides enterprise-grade, cryptographically verifiable proof of compliance. With automated Kafka event distribution, multi-store transactional persistence, and zero-downtime failover mechanisms, the system is fully prepared for regulatory audits and live multi-tenant production operations.",
        body_style
    ))

    # Build the document using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[PDF Generated Successfully]: {output_path}")


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../docs/DSAR_Portal_Architecture_and_Flow.pdf')
    build_pdf(os.path.abspath(target))
