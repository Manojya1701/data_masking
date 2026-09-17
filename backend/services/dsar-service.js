'use strict';

/**
 * DSAR (Data Subject Access Request) Service
 * Manages Step 1 Intake Requests, Operator Task Assignment, Compliance Reporting & Erasure Pipeline Tracking in Segmento Protect.
 */

const db = require('../database/db');

function formatDueDate(date = new Date()) {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function calculateDefaultDueDate(daysFromNow = 30) {
  const target = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return formatDueDate(target);
}

// Default initial DSAR intake requests matching Segmento Protect architecture & mockups
const DEFAULT_INITIAL_REQUESTS = [
  {
    id: 1,
    request_id: 'DSAR-2026-000125',
    full_name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+65 9123 4567',
    country: 'Singapore',
    relationship: 'Customer',
    customer_id: 'CUST-8842',
    request_type: 'Deletion',
    subject_category: 'customer',
    request_details: 'Delete all personal browsing logs, marketing telemetry, and customer profile.',
    verification_type: 'Government ID',
    verification_evidence: 'Passport Verified (#SG-PASS-8842)',
    due_date: 'Sep 22, 2026',
    status: 'In Progress',
    assigned_to: 'John Doe',
    priority: 'High',
    internal_notes: 'Urgent deletion requested under SG PDPA. All telemetry systems scheduled for wipe.',
    created_at: '2026-08-23T08:30:00.000Z'
  },
  {
    id: 2,
    request_id: 'DSAR-2026-000124',
    full_name: 'Sarah Lee',
    email: 'sarah.lee@example.com',
    phone: '+1 555 019 2834',
    country: 'United States',
    relationship: 'Customer',
    customer_id: 'CUST-3319',
    request_type: 'Access',
    subject_category: 'customer',
    request_details: 'Export full transaction ledger and profile history.',
    verification_type: 'Email OTP',
    verification_evidence: 'Registered Email OTP Verified (#OTP-9921)',
    due_date: 'Sep 24, 2026',
    status: 'Assigned',
    assigned_to: 'Sarah Lee',
    priority: 'Medium',
    internal_notes: 'Complete export package prepared for customer portal download.',
    created_at: '2026-08-25T11:20:00.000Z'
  },
  {
    id: 3,
    request_id: 'DSAR-2026-000123',
    full_name: 'Michael Tan',
    email: 'michael.tan@example.com',
    phone: '+65 8234 5678',
    country: 'Singapore',
    relationship: 'Employee',
    customer_id: 'EMP-9021',
    request_type: 'Rectification',
    subject_category: 'employee',
    request_details: 'Correct payroll residential address and update contact number.',
    verification_type: 'Account Auth',
    verification_evidence: 'Internal SSO & HR Badge Auth (#SSO-441)',
    due_date: 'Sep 21, 2026',
    status: 'In Progress',
    assigned_to: 'John Doe',
    priority: 'Medium',
    internal_notes: 'HR records updated, pending payroll department validation.',
    created_at: '2026-08-22T14:15:00.000Z'
  },
  {
    id: 4,
    request_id: 'DSAR-2026-000122',
    full_name: 'Priya Nair',
    email: 'priya.nair@example.in',
    phone: '+91 98765 12340',
    country: 'India',
    relationship: 'Former Customer',
    customer_id: 'CUST-5510',
    request_type: 'Restrict',
    subject_category: 'former_customer',
    request_details: 'Restrict automated processing pending active account dispute.',
    verification_type: 'Government ID',
    verification_evidence: 'National ID Verified (#IN-UID-1234)',
    due_date: 'Sep 26, 2026',
    status: 'Not Started',
    assigned_to: 'Alex Chen',
    priority: 'Critical',
    internal_notes: 'Customer dispute ongoing. Processing hold active under DPDP Sec. 8.',
    created_at: '2026-08-27T16:00:00.000Z'
  },
  {
    id: 5,
    request_id: 'DSAR-2026-000121',
    full_name: 'David Kim',
    email: 'david.kim@example.com',
    phone: '+82 10 2345 6789',
    country: 'South Korea',
    relationship: 'Customer',
    customer_id: 'CUST-1192',
    request_type: 'Portability',
    subject_category: 'customer',
    request_details: 'Export all telemetry, order history, and preferences in JSON format.',
    verification_type: 'Account Auth',
    verification_evidence: '2FA Mobile Auth (#MFA-881)',
    due_date: 'Sep 18, 2026',
    status: 'Completed',
    assigned_to: 'John Doe',
    priority: 'Low',
    internal_notes: 'Portability archive delivered via encrypted JSON package.',
    created_at: '2026-08-19T09:00:00.000Z'
  },
  {
    id: 6,
    request_id: 'DSAR-2026-000101',
    full_name: 'Vikram Patel',
    email: 'vikram.patel@example.in',
    phone: '+91 98765 43210',
    country: 'India',
    relationship: 'Customer',
    customer_id: 'CUST-8891',
    request_type: 'full_erasure',
    subject_category: 'customer',
    request_details: 'Complete erasure under DPDP Act 2023 Sec. 12(3).',
    verification_type: 'Government ID',
    verification_evidence: 'Government ID & Aadhaar Verified (#ID-8891)',
    due_date: 'Sep 30, 2026',
    status: 'RECEIVED',
    assigned_to: 'Sarah Lee',
    priority: 'High',
    internal_notes: 'Aadhaar ID verified. Legal retention check required for GST records.',
    created_at: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 7,
    request_id: 'DSAR-2026-000456',
    full_name: 'Alice Smith',
    email: 'alice.smith@example.com',
    phone: '+91 99887 76655',
    country: 'United States',
    relationship: 'Customer',
    customer_id: 'CUST-9901',
    request_type: 'full_erasure',
    subject_category: 'customer',
    request_details: 'Full GDPR right to erasure.',
    verification_type: 'Email OTP',
    verification_evidence: 'Email OTP Verified (#OTP-334)',
    due_date: 'Oct 02, 2026',
    status: 'RECEIVED',
    assigned_to: 'Michael Tan',
    priority: 'Medium',
    internal_notes: 'Email OTP confirmed. Target profile scan complete.',
    created_at: '2026-09-02T11:15:00.000Z'
  },
  {
    id: 8,
    request_id: 'DSAR-2026-000789',
    full_name: 'Vikram Malhotra',
    email: 'vikram.legal@company.com',
    phone: '+91 99887 76655',
    country: 'India',
    relationship: 'Customer',
    customer_id: 'CUST-1044',
    request_type: 'restrict_processing',
    subject_category: 'customer',
    request_details: 'Legal dispute hold and processing freeze.',
    verification_type: 'Court Order',
    verification_evidence: 'Court Subpoena & Legal Compliance Lock (#LEGAL-990)',
    due_date: 'Oct 03, 2026',
    status: 'RECEIVED',
    assigned_to: 'John Doe',
    priority: 'Critical',
    internal_notes: 'Court subpoena hold active. Restrict processing until judicial resolution.',
    created_at: '2026-09-03T14:30:00.000Z'
  },
  {
    id: 9,
    request_id: 'DSAR-2026-000518',
    full_name: 'Priya Sharma',
    email: 'priya@gmail.com',
    phone: '+91 91234 56789',
    country: 'India',
    relationship: 'Customer',
    customer_id: 'CUST-7712',
    request_type: 'anonymization',
    subject_category: 'customer',
    request_details: 'Anonymize personal data in analytics databases.',
    verification_type: 'Mobile OTP',
    verification_evidence: 'Mobile OTP Verified (#OTP-518)',
    due_date: 'Oct 04, 2026',
    status: 'RECEIVED',
    assigned_to: 'Alex Chen',
    priority: 'Medium',
    internal_notes: 'Anonymization request for marketing analytics database.',
    created_at: '2026-09-04T09:45:00.000Z'
  }
];

let FALLBACK_DSAR_REQUESTS = JSON.parse(JSON.stringify(DEFAULT_INITIAL_REQUESTS));

/**
 * Generate a unique compliance tracking ID formatted as DSAR-YYYY-XXXXXX
 */
function generateDsarTrackingId() {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `DSAR-${year}-${randomDigits}`;
}

/**
 * Normalizes request type for display and classification
 */
function normalizeRequestType(type = '') {
  const raw = String(type).trim();
  const lower = raw.toLowerCase();
  if (lower.includes('erasure') || lower === 'deletion' || lower === 'delete') return 'Deletion';
  if (lower.includes('access') || lower === 'export') return 'Access';
  if (lower.includes('rectif') || lower === 'correct') return 'Rectification';
  if (lower.includes('restrict') || lower.includes('hold')) return 'Restrict';
  if (lower.includes('portab')) return 'Portability';
  if (lower.includes('anonym')) return 'Anonymization';
  return raw || 'Deletion';
}

/**
 * Submit a new DSAR Intake Request (Step 1).
 */
async function createDsarRequest(data = {}) {
  const fullName = (data.fullName || data.full_name || '').trim();
  const email = (data.email || '').trim().toLowerCase();
  const phone = (data.phone || '').trim();
  const country = (data.country || 'India').trim();
  const relationship = (data.relationship || data.relationshipWithOrg || data.subjectCategory || data.subject_category || 'Customer').trim();
  const customerId = (data.customerId || data.customer_id || '').trim();
  const rawRequestType = (data.requestType || data.request_type || 'Deletion').trim();
  const requestType = normalizeRequestType(rawRequestType);
  const subjectCategory = (data.subjectCategory || data.subject_category || relationship.toLowerCase() || 'customer').trim();
  const requestDetails = (data.requestDetails || data.request_details || data.scope || 'Standard DSAR Request').trim();
  const verificationType = (data.verificationType || data.verification_type || 'Government ID').trim();
  const verificationEvidence = (data.verificationEvidence || data.verification_evidence || `${verificationType} Verified`).trim();
  const dueDate = (data.dueDate || data.due_date || calculateDefaultDueDate(30)).trim();
  const status = (data.status || 'RECEIVED').trim();
  const assignedTo = (data.assignedTo || data.assigned_to || 'John Doe').trim();
  const priority = (data.priority || 'High').trim();
  const internalNotes = (data.internalNotes || data.internal_notes || `Intake registered via privacy portal for ${fullName}`).trim();

  if (!fullName) {
    return { success: false, message: 'Data Subject Full Name is required' };
  }

  if (!email || !email.includes('@')) {
    return { success: false, message: 'Valid Data Subject Email is required' };
  }

  const requestId = data.requestId || data.request_id || generateDsarTrackingId();

  if (db.isConfigured()) {
    try {
      const sql = `
        INSERT INTO dsar_requests (
          request_id, full_name, email, phone, customer_id, request_type, subject_category, verification_evidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, request_id, created_at;
      `;
      const res = await db.query(sql, [
        requestId, fullName, email, phone || null, customerId || null, requestType, subjectCategory, verificationEvidence || null, status
      ]);

      const record = {
        id: res?.rows?.[0]?.id || (FALLBACK_DSAR_REQUESTS.length + 1),
        request_id: requestId,
        full_name: fullName,
        email,
        phone,
        country,
        relationship,
        customer_id: customerId,
        request_type: requestType,
        subject_category: subjectCategory,
        request_details: requestDetails,
        verification_type: verificationType,
        verification_evidence: verificationEvidence,
        due_date: dueDate,
        status,
        assigned_to: assignedTo,
        priority,
        internal_notes: internalNotes,
        created_at: res?.rows?.[0]?.created_at || new Date().toISOString()
      };

      FALLBACK_DSAR_REQUESTS.unshift(record);
      return { success: true, message: 'DSAR Intake Request registered successfully', record };
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to insert DB request:', err.message);
    }
  }

  const newRecord = {
    id: FALLBACK_DSAR_REQUESTS.length + 1,
    request_id: requestId,
    full_name: fullName,
    email,
    phone,
    country,
    relationship,
    customer_id: customerId,
    request_type: requestType,
    subject_category: subjectCategory,
    request_details: requestDetails,
    verification_type: verificationType,
    verification_evidence: verificationEvidence,
    due_date: dueDate,
    status,
    assigned_to: assignedTo,
    priority,
    internal_notes: internalNotes,
    created_at: new Date().toISOString()
  };

  FALLBACK_DSAR_REQUESTS.unshift(newRecord);
  return { success: true, message: 'DSAR Intake Request registered successfully', record: newRecord };
}

/**
 * Fetch all active DSAR Intake Requests with KPI calculation.
 */
async function getDsarRequests() {
  let records = [];

  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT * FROM dsar_requests ORDER BY created_at DESC;');
      if (res && res.rows && res.rows.length > 0) {
        records = res.rows.map(row => {
          const match = FALLBACK_DSAR_REQUESTS.find(f => f.request_id === row.request_id);
          return {
            ...row,
            assigned_to: row.assigned_to || match?.assigned_to || 'John Doe',
            priority: row.priority || match?.priority || 'Medium',
            internal_notes: row.internal_notes || match?.internal_notes || '',
            country: row.country || match?.country || 'India',
            relationship: row.relationship || match?.relationship || 'Customer'
          };
        });
      }
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to fetch DB requests:', err.message);
    }
  }

  if (!records || records.length === 0) {
    records = JSON.parse(JSON.stringify(FALLBACK_DSAR_REQUESTS));
  }

  // Calculate high-level KPIs dynamically from real records
  const total = records.length;
  let inProgress = 0;
  let completed = 0;
  let slaBreaches = 0;

  records.forEach(r => {
    const st = String(r.status || '').toUpperCase();
    if (st.includes('COMPLET') || st.includes('CERTIF') || st.includes('CLOSED') || st.includes('APPROVED')) {
      completed++;
    } else if (st.includes('BREACH') || st.includes('OVERDUE')) {
      slaBreaches++;
    } else {
      inProgress++;
    }
  });

  return {
    success: true,
    count: records.length,
    kpis: {
      total: total,
      totalRequests: total,
      inProgress: inProgress,
      inProgressCount: inProgress,
      completed: completed,
      completedCount: completed,
      slaBreaches: slaBreaches,
      slaBreachesCount: slaBreaches,
      actualActive: inProgress
    },
    records
  };
}

/**
 * Fetch a single DSAR Request by tracking ID.
 */
async function getDsarRequestById(requestId) {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT * FROM dsar_requests WHERE request_id = $1 LIMIT 1;', [requestId]);
      if (res && res.rows && res.rows.length > 0) {
        const match = FALLBACK_DSAR_REQUESTS.find(f => f.request_id === requestId);
        const record = {
          ...res.rows[0],
          assigned_to: res.rows[0].assigned_to || match?.assigned_to || 'John Doe',
          priority: res.rows[0].priority || match?.priority || 'Medium',
          internal_notes: res.rows[0].internal_notes || match?.internal_notes || '',
          country: res.rows[0].country || match?.country || 'India'
        };
        return { success: true, record };
      }
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to fetch request by ID:', err.message);
    }
  }

  const found = FALLBACK_DSAR_REQUESTS.find(r => r.request_id === requestId);
  if (found) return { success: true, record: JSON.parse(JSON.stringify(found)) };
  return { success: false, notFound: true, message: 'DSAR Request not found' };
}

/**
 * Update an existing DSAR Task (Assignee, Priority, Status, Internal Notes).
 */
async function updateDsarTask(requestId, updateData = {}) {
  if (!requestId) {
    return { success: false, message: 'Request ID is required' };
  }

  const foundIndex = FALLBACK_DSAR_REQUESTS.findIndex(r => r.request_id === requestId);
  if (foundIndex === -1) {
    return { success: false, notFound: true, message: `DSAR Request ${requestId} not found` };
  }

  const current = FALLBACK_DSAR_REQUESTS[foundIndex];

  if (updateData.assigned_to !== undefined || updateData.assignedTo !== undefined) {
    current.assigned_to = updateData.assigned_to || updateData.assignedTo;
  }
  if (updateData.priority !== undefined) {
    current.priority = updateData.priority;
  }
  if (updateData.status !== undefined) {
    current.status = updateData.status;
  }
  if (updateData.internal_notes !== undefined || updateData.internalNotes !== undefined) {
    current.internal_notes = updateData.internal_notes || updateData.internalNotes;
  }

  if (db.isConfigured()) {
    try {
      await db.query(
        'UPDATE dsar_requests SET status = $1 WHERE request_id = $2;',
        [current.status, requestId]
      );
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to update DB task:', err.message);
    }
  }

  return {
    success: true,
    message: `Task ${requestId} updated successfully`,
    record: JSON.parse(JSON.stringify(current))
  };
}

/**
 * Aggregates complete Compliance & Analytics Reports metrics.
 */
async function getDsarComplianceReports() {
  const { records } = await getDsarRequests();

  // 1. Jurisdiction Distribution
  const jurisdictions = {};
  // 2. Request Types Distribution
  const requestTypes = {};
  // 3. Status Breakdown
  const statusCounts = {};
  // 4. Team Workload Breakdown
  const teamWorkload = {
    'John Doe': 0,
    'Sarah Lee': 0,
    'Michael Tan': 0,
    'Alex Chen': 0,
    'Unassigned': 0
  };
  // 5. Priorities Breakdown
  const priorities = { Critical: 0, High: 0, Medium: 0, Low: 0 };

  records.forEach(r => {
    // Country / Law
    const c = r.country || 'India';
    let lawLabel = 'India (DPDP Act 2023)';
    if (c.toLowerCase().includes('singapore')) lawLabel = 'Singapore (PDPA)';
    else if (c.toLowerCase().includes('united states') || c.toLowerCase().includes('us')) lawLabel = 'United States (CCPA/CPRA)';
    else if (c.toLowerCase().includes('european') || c.toLowerCase().includes('eu') || c.toLowerCase().includes('germany') || c.toLowerCase().includes('france')) lawLabel = 'European Union (GDPR)';
    else if (c.toLowerCase().includes('korea')) lawLabel = 'South Korea (PIPA)';
    else if (c.toLowerCase().includes('kingdom') || c.toLowerCase().includes('uk')) lawLabel = 'United Kingdom (UK GDPR)';
    
    jurisdictions[lawLabel] = (jurisdictions[lawLabel] || 0) + 1;

    // Type
    const rt = normalizeRequestType(r.request_type || 'Deletion');
    requestTypes[rt] = (requestTypes[rt] || 0) + 1;

    // Status
    const st = r.status || 'In Progress';
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    // Team Workload
    const assignee = r.assigned_to || 'Unassigned';
    if (teamWorkload[assignee] !== undefined) {
      teamWorkload[assignee]++;
    } else {
      teamWorkload[assignee] = 1;
    }

    // Priority
    const p = r.priority || 'Medium';
    if (priorities[p] !== undefined) priorities[p]++;
  });

  return {
    success: true,
    totalRequests: records.length,
    complianceRate: '100%',
    avgSlaTurnaroundDays: 4.2,
    slaBreachesCount: 0,
    activeJurisdictionsCount: Object.keys(jurisdictions).length,
    jurisdictions,
    requestTypes,
    statusCounts,
    teamWorkload,
    priorities,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate downloadable CSV string for Compliance Audit Reports.
 */
async function exportDsarComplianceCsv() {
  const { records } = await getDsarRequests();

  const headers = [
    'DSAR Tracking ID',
    'Data Subject Name',
    'Email Address',
    'Jurisdiction / Country',
    'Right Type',
    'Status',
    'Assigned Officer',
    'Priority',
    'Due Date',
    'Intake Date',
    'Internal Case Notes'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = records.map(r => [
    escapeCsv(r.request_id),
    escapeCsv(r.full_name),
    escapeCsv(r.email),
    escapeCsv(r.country || 'India'),
    escapeCsv(normalizeRequestType(r.request_type)),
    escapeCsv(r.status),
    escapeCsv(r.assigned_to || 'John Doe'),
    escapeCsv(r.priority || 'Medium'),
    escapeCsv(r.due_date),
    escapeCsv(r.created_at ? new Date(r.created_at).toLocaleDateString('en-US') : ''),
    escapeCsv(r.internal_notes || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Reset DSAR queue to clean minimal demo records.
 */
async function resetDsarRequests() {
  FALLBACK_DSAR_REQUESTS = JSON.parse(JSON.stringify(DEFAULT_INITIAL_REQUESTS));

  if (db.isConfigured()) {
    try {
      await db.query('DELETE FROM dsar_identity_maps;');
      await db.query('DELETE FROM dsar_impact_reports;');
      await db.query('DELETE FROM dsar_policy_evaluations;');
      await db.query('DELETE FROM dsar_execution_reports;');
      await db.query('DELETE FROM dsar_verification_reports;');
      await db.query('DELETE FROM dsar_certificates;');
      await db.query('DELETE FROM dsar_requests;');
      for (const r of DEFAULT_INITIAL_REQUESTS) {
        await db.query(`
          INSERT INTO dsar_requests (
            request_id, full_name, email, phone, customer_id, request_type, subject_category, verification_evidence, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          r.request_id, r.full_name, r.email, r.phone, r.customer_id, r.request_type, r.subject_category, r.verification_evidence, r.status, r.created_at
        ]);
      }
    } catch (err) {
      console.warn('[DSAR Service Warning] DB reset error:', err.message);
    }
  }

  return { success: true, message: 'DSAR requests queue successfully reset to clean demo records', count: DEFAULT_INITIAL_REQUESTS.length, records: DEFAULT_INITIAL_REQUESTS };
}


// In-memory cache for dynamic ticket details (Subtasks, Approvals, Communications, Audit Log)
const DSAR_SUBTASKS_MAP = new Map();
const DSAR_APPROVALS_MAP = new Map();
const DSAR_COMMUNICATIONS_MAP = new Map();

/**
 * Generate default 6 cross-functional departmental tasks for a given DSAR request
 */
function generateCrossTeamTasks(requestId, requestType = 'Deletion', dataSubject = 'Customer') {
  if (DSAR_SUBTASKS_MAP.has(requestId)) {
    return DSAR_SUBTASKS_MAP.get(requestId);
  }

  const tasks = [
    {
      id: 'task_1',
      task: 'Find customer records',
      description: 'This task involves searching for customer data related to the requester across CRM systems and related databases.',
      team: 'CRM Team',
      teamIcon: '👥',
      teamColor: '#f59e0b',
      assignee: 'John Tan',
      lead: 'John Tan (Lead)',
      priority: 'High',
      due_date: 'Sep 18, 2026',
      dataSources: 'CRM, Customer DB',
      systems: 'Salesforce, Oracle',
      status: 'In Progress',
      completed_at: null,
      instructions: [
        { text: "Search for customer records matching the requester's details (name, email, phone number).", done: true },
        { text: "Identify all related accounts and transactions.", done: true },
        { text: "Export the data in the required format (JSON/CSV).", done: false },
        { text: "Update task with findings and attach evidence.", done: false }
      ],
      evidence: [
        { id: 'ev_1', name: 'crm_customer_lookup_DSAR-125.csv', size: '24.5 KB', uploadedAt: '2026-08-24 14:30', uploadedBy: 'John Tan' },
        { id: 'ev_2', name: 'salesforce_account_snapshot.json', size: '12.8 KB', uploadedAt: '2026-08-24 14:32', uploadedBy: 'John Tan' }
      ],
      comments: [
        { id: 'cmt_1', author: 'John Tan', role: 'CRM Lead', time: 'Aug 24, 2026, 02:35 PM', text: 'Queried Salesforce API cluster US-West. Located 2 matching accounts and customer telemetry logs.' },
        { id: 'cmt_2', author: 'Anil Reddy', role: 'Chief DPO', time: 'Aug 24, 2026, 03:00 PM', text: 'Please ensure billing transaction history is flagged for 7-year statutory retention.' }
      ],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' },
        { action: 'Status changed to In Progress', timestamp: 'Aug 24, 2026, 02:30 PM', actor: 'John Tan' },
        { action: 'Evidence uploaded (2 files)', timestamp: 'Aug 24, 2026, 02:32 PM', actor: 'John Tan' }
      ]
    },
    {
      id: 'task_2',
      task: 'Search employee records',
      description: 'Search internal HRIS and employee identity databases for candidate, employee, or contractor records.',
      team: 'HR Team',
      teamIcon: '🏢',
      teamColor: '#10b981',
      assignee: 'Priya Sharma',
      lead: 'Priya Sharma (Lead)',
      priority: 'High',
      due_date: 'Sep 18, 2026',
      dataSources: 'HRIS, Employee DB',
      systems: 'Workday, BambooHR, Employee PostgreSQL',
      status: 'Not Started',
      completed_at: null,
      instructions: [
        { text: "Query internal HRIS for historical applicant or employee files matching email.", done: false },
        { text: "Verify presence of tax documents, payroll slips, and resume attachments.", done: false },
        { text: "Flag any active legal holds or statutory employment audit locks.", done: false },
        { text: "Attach verification summary log.", done: false }
      ],
      evidence: [],
      comments: [],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' }
      ]
    },
    {
      id: 'task_3',
      task: 'Marketing data search',
      description: 'Query marketing automation, newsletter email subscribers, and web telemetry tracking events.',
      team: 'Marketing Team',
      teamIcon: '📢',
      teamColor: '#a78bfa',
      assignee: 'David Lee',
      lead: 'David Lee (Lead)',
      priority: 'Medium',
      due_date: 'Sep 20, 2026',
      dataSources: 'Email Campaigns, Analytics',
      systems: 'HubSpot, Marketo, Google Analytics',
      status: 'Not Started',
      completed_at: null,
      instructions: [
        { text: "Search HubSpot and Mailchimp for marketing subscription profiles.", done: false },
        { text: "Check analytics telemetry databases for tracking cookies and identifiers.", done: false },
        { text: "Unsubscribe and purge ad retargeting segments.", done: false },
        { text: "Log confirmation of unsubscribe and purge.", done: false }
      ],
      evidence: [],
      comments: [],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' }
      ]
    },
    {
      id: 'task_4',
      task: 'Data deletion',
      description: 'Execute physical purge and cryptographic pseudonymization across central data lake and SQL tables.',
      team: 'Data Engineering',
      teamIcon: '🗄️',
      teamColor: '#06b6d4',
      assignee: 'Arun Kumar',
      lead: 'Arun Kumar (Lead)',
      priority: 'High',
      due_date: 'Sep 22, 2026',
      dataSources: 'Data Lake, Warehouses',
      systems: 'PostgreSQL, Snowflake, AWS S3',
      status: 'Not Started',
      completed_at: null,
      instructions: [
        { text: "Execute automated SQL deletion queries on relational customer tables.", done: false },
        { text: "Run cryptographic pseudonymization on historical financial transaction records.", done: false },
        { text: "Purge object store temp logs and staging buckets.", done: false },
        { text: "Verify database query execution hash.", done: false }
      ],
      evidence: [],
      comments: [],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' }
      ]
    },
    {
      id: 'task_5',
      task: 'Third-party data check',
      description: 'Notify and request data wipe confirmation from integrated third-party SaaS vendors and sub-processors.',
      team: 'Vendor Mgmt',
      teamIcon: '🤝',
      teamColor: '#3b82f6',
      assignee: 'Sarah Lim',
      lead: 'Sarah Lim (Lead)',
      priority: 'Medium',
      due_date: 'Sep 21, 2026',
      dataSources: 'Vendors, Partners',
      systems: 'Stripe, Zendesk, AWS Sub-processors',
      status: 'Not Started',
      completed_at: null,
      instructions: [
        { text: "Send automated erasure dispatch to third-party sub-processors (Stripe, Zendesk).", done: false },
        { text: "Collect cryptographic deletion acknowledgments from all vendors.", done: false },
        { text: "Verify vendor compliance within statutory SLA.", done: false },
        { text: "Attach vendor confirmation certificates.", done: false }
      ],
      evidence: [],
      comments: [],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' }
      ]
    },
    {
      id: 'task_6',
      task: 'Privacy review',
      description: 'Conduct statutory exemption check (DPDP Sec. 8 / GST / RBI) and sign off final compliance attestation.',
      team: 'Privacy Team',
      teamIcon: '⚖️',
      teamColor: '#ef4444',
      assignee: 'Anil Reddy',
      lead: 'Anil Reddy (Lead)',
      priority: 'High',
      due_date: 'Sep 24, 2026',
      dataSources: 'Compliance Ledger',
      systems: 'Segmento Policy Engine, Ledger DB',
      status: 'Not Started',
      completed_at: null,
      instructions: [
        { text: "Review overall DSAR package against India DPDP Act 2023 & GDPR Art. 17.", done: false },
        { text: "Confirm compliance with statutory retention overrides (GST Act Sec. 36).", done: false },
        { text: "Sign official DPO digital attestation seal.", done: false },
        { text: "Prepare immutable audit trail manifest.", done: false }
      ],
      evidence: [],
      comments: [],
      history: [
        { action: 'Task Generated & Assigned', timestamp: 'Aug 23, 2026, 08:40 AM', actor: 'Automated Orchestrator' }
      ]
    }
  ];

  DSAR_SUBTASKS_MAP.set(requestId, tasks);
  return tasks;
}

/**
 * Fetch full ticket details for Screen 3 (all 7 tabs: Overview, Requester, Data Discovery, Tasks, Approvals, Communications, Audit Log)
 */
async function getDsarTicketDetails(requestId) {
  const reqRes = await getDsarRequestById(requestId);
  if (!reqRes.success) {
    return { success: false, notFound: true, message: `DSAR Request ${requestId} not found` };
  }

  const record = reqRes.record;
  const tasks = generateCrossTeamTasks(requestId, record.request_type, record.full_name);

  // Overview Stats
  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length;
  const overview = {
    currentStage: 3,
    totalStages: 6,
    stageName: 'Team Execution & Verification',
    daysRemaining: 18,
    slaStatus: 'On Track (100% compliant)',
    completedTasksCount,
    totalTasksCount: tasks.length
  };

  // Requester Dossier
  const requester = {
    fullName: record.full_name,
    email: record.email,
    phone: record.phone || '+65 9123 4567',
    country: record.country || 'Singapore',
    relationship: record.relationship || 'Customer',
    customerId: record.customer_id || 'CUST-8842',
    requestType: normalizeRequestType(record.request_type),
    requestDetails: record.request_details || 'Standard privacy right erasure request',
    verificationType: record.verification_type || 'Government ID',
    verificationEvidence: record.verification_evidence || 'Passport Verified (#SG-PASS-8842)',
    submittedDate: record.created_at ? new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Aug 23, 2026'
  };

  // Approvals State
  let approvals = DSAR_APPROVALS_MAP.get(requestId);
  if (!approvals) {
    approvals = {
      dpoApproval: {
        officer: 'Anil Reddy (DPO)',
        status: 'PENDING',
        statutoryLock: 'GST Act 7-Yr Lock Verified',
        signedAt: null
      },
      legalApproval: {
        officer: 'Vikram Malhotra (Lead Counsel)',
        status: 'APPROVED',
        signedAt: '2026-08-26T10:00:00.000Z'
      }
    };
    DSAR_APPROVALS_MAP.set(requestId, approvals);
  }

  // Communications Timeline
  let communications = DSAR_COMMUNICATIONS_MAP.get(requestId);
  if (!communications) {
    communications = [
      {
        id: 'msg_1',
        title: 'DSAR Request Intake Acknowledged',
        recipient: record.email,
        timestamp: 'Aug 23, 2026, 08:31 AM',
        status: 'Delivered',
        preview: `Your privacy request ${requestId} has been received and assigned tracking token #TKN-8821.`
      },
      {
        id: 'msg_2',
        title: 'Identity Verification Confirmed',
        recipient: record.email,
        timestamp: 'Aug 23, 2026, 09:15 AM',
        status: 'Delivered',
        preview: 'Identity verification evidence confirmed under DPDP Act 2023 / GDPR Art. 17 requirements.'
      },
      {
        id: 'msg_3',
        title: 'Cross-System Privacy Processing Update',
        recipient: record.email,
        timestamp: 'Aug 24, 2026, 02:00 PM',
        status: 'Delivered',
        preview: 'Departmental tasks generated. Deletion and pseudonymization pipeline in progress.'
      }
    ];
    DSAR_COMMUNICATIONS_MAP.set(requestId, communications);
  }

  // Cryptographic Audit Log
  const auditLog = [
    {
      timestamp: '2026-08-23T08:30:00.000Z',
      action: 'DSAR_INTAKE_SUBMITTED',
      actor: 'Public Portal Webform',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      timestamp: '2026-08-23T08:35:00.000Z',
      action: 'AI_IDENTITY_RESOLUTION_EXECUTED',
      actor: 'Segmento AI Resolution Engine',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    },
    {
      timestamp: '2026-08-23T08:40:00.000Z',
      action: 'CROSS_TEAM_TASKS_GENERATED',
      actor: 'Workflow Orchestrator',
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'
    },
    {
      timestamp: '2026-08-24T11:00:00.000Z',
      action: 'LEGAL_STATUTORY_POLICY_CHECK',
      actor: 'Policy Engine v2.4',
      sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
    }
  ];

  return {
    success: true,
    requestId,
    record,
    overview,
    requester,
    tasks,
    approvals,
    communications,
    auditLog
  };
}

/**
 * Update an individual departmental subtask
 */
async function updateDsarSubtask(requestId, taskId, updateData = {}) {
  const tasks = generateCrossTeamTasks(requestId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, notFound: true, message: `Subtask ${taskId} not found for request ${requestId}` };
  }

  if (updateData.status) {
    task.status = updateData.status;
    if (updateData.status === 'Completed') {
      task.completed_at = new Date().toISOString();
    }
  }
  if (updateData.assignee) task.assignee = updateData.assignee;
  if (updateData.priority) task.priority = updateData.priority;

  DSAR_SUBTASKS_MAP.set(requestId, tasks);

  return {
    success: true,
    message: `Subtask ${task.task} updated to ${task.status}`,
    task,
    tasks
  };
}

/**
 * Record DPO / Legal sign-off
 */
async function submitDsarApproval(requestId, approvalData = {}) {
  let approvals = DSAR_APPROVALS_MAP.get(requestId);
  if (!approvals) {
    await getDsarTicketDetails(requestId);
    approvals = DSAR_APPROVALS_MAP.get(requestId);
  }

  const role = approvalData.role || 'dpoApproval';
  if (approvals && approvals[role]) {
    approvals[role].status = approvalData.status || 'APPROVED';
    approvals[role].signedAt = new Date().toISOString();
    approvals[role].signedBy = approvalData.signedBy || 'Anil Reddy (DPO)';
    DSAR_APPROVALS_MAP.set(requestId, approvals);
    return { success: true, message: `Approval recorded for ${role}`, approvals };
  }

  return { success: false, message: 'Invalid approval role' };
}

/**
 * Export the 6 departmental tasks for a DSAR request in CSV format
 */
async function exportDsarTasksCsv(requestId) {
  const reqRes = await getDsarRequestById(requestId);
  const record = reqRes.record || { request_id: requestId, full_name: 'Requester' };
  const tasks = generateCrossTeamTasks(requestId, record.request_type, record.full_name);

  const headers = ['Task ID', 'Task Name', 'Department / Team', 'Lead Assignee', 'Priority', 'Due Date', 'Connected Systems', 'Status', 'Completed Timestamp'];
  const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

  const rows = tasks.map(t => [
    escapeCsv(t.id),
    escapeCsv(t.task),
    escapeCsv(t.team),
    escapeCsv(t.assignee),
    escapeCsv(t.priority),
    escapeCsv(t.due_date),
    escapeCsv(t.systems),
    escapeCsv(t.status),
    escapeCsv(t.completed_at || '-')
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}



/**
 * Screen 4: Fetch Team Assignment & Task Distribution Overview
 */
async function getTaskAssignmentOverview(requestId) {
  const reqRes = await getDsarRequestById(requestId);
  if (!reqRes.success) {
    return { success: false, notFound: true, message: `DSAR Request ${requestId} not found` };
  }

  const record = reqRes.record;
  const tasks = generateCrossTeamTasks(requestId, record.request_type, record.full_name);

  return {
    success: true,
    requestId,
    requestType: normalizeRequestType(record.request_type),
    fullName: record.full_name,
    email: record.email,
    banner: {
      title: 'Automatic Task Generation',
      message: `Based on the request type (${normalizeRequestType(record.request_type)}) and data domains identified, we have created ${tasks.length} tasks across ${tasks.length} teams.`,
      tasksCount: tasks.length,
      teamsCount: tasks.length
    },
    teams: tasks.map(t => ({
      taskId: t.id,
      team: t.team,
      teamIcon: t.teamIcon || '👥',
      teamColor: t.teamColor || '#06b6d4',
      lead: t.lead || `${t.assignee} (Lead)`,
      assignee: t.assignee,
      assignedTask: t.task,
      priority: t.priority,
      dueDate: t.due_date,
      status: t.status,
      systems: t.systems
    }))
  };
}

/**
 * Screen 5: Fetch Individual Subtask Workspace Details
 */
async function getIndividualSubtaskDetail(requestId, taskId) {
  const reqRes = await getDsarRequestById(requestId);
  const record = reqRes.success ? reqRes.record : { request_id: requestId, full_name: 'Requester' };
  const tasks = generateCrossTeamTasks(requestId, record.request_type, record.full_name);

  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, notFound: true, message: `Subtask ${taskId} not found for request ${requestId}` };
  }

  return {
    success: true,
    requestId,
    requester: {
      fullName: record.full_name,
      email: record.email,
      requestType: normalizeRequestType(record.request_type)
    },
    task
  };
}

/**
 * Screen 5: Toggle Subtask Instruction Checklist Item
 */
async function toggleSubtaskInstruction(requestId, taskId, instructionIndex, completed) {
  const tasks = generateCrossTeamTasks(requestId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, notFound: true, message: `Subtask ${taskId} not found` };
  }

  const idx = parseInt(instructionIndex, 10);
  if (task.instructions && task.instructions[idx] !== undefined) {
    task.instructions[idx].done = Boolean(completed);
    task.history.push({
      action: `Checklist item ${idx + 1} marked as ${completed ? 'completed' : 'incomplete'}`,
      timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      actor: task.assignee
    });
    DSAR_SUBTASKS_MAP.set(requestId, tasks);
    return { success: true, message: 'Checklist updated', task };
  }

  return { success: false, message: 'Invalid instruction index' };
}

/**
 * Screen 5: Add Evidence Attachment to Subtask
 */
async function addSubtaskEvidence(requestId, taskId, evidenceData = {}) {
  const tasks = generateCrossTeamTasks(requestId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, notFound: true, message: `Subtask ${taskId} not found` };
  }

  const newEv = {
    id: `ev_${Date.now()}`,
    name: evidenceData.name || 'evidence_export.csv',
    size: evidenceData.size || '18.4 KB',
    uploadedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    uploadedBy: evidenceData.uploadedBy || task.assignee || 'Operator'
  };

  if (!task.evidence) task.evidence = [];
  task.evidence.unshift(newEv);
  task.history.push({
    action: `Evidence attached: ${newEv.name}`,
    timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    actor: newEv.uploadedBy
  });

  DSAR_SUBTASKS_MAP.set(requestId, tasks);
  return { success: true, message: 'Evidence attached successfully', evidence: newEv, task };
}

/**
 * Screen 5: Add Comment to Subtask
 */
async function addSubtaskComment(requestId, taskId, commentData = {}) {
  const tasks = generateCrossTeamTasks(requestId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return { success: false, notFound: true, message: `Subtask ${taskId} not found` };
  }

  const newComment = {
    id: `cmt_${Date.now()}`,
    author: commentData.author || task.assignee || 'Privacy Operator',
    role: commentData.role || `${task.team} Member`,
    time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    text: commentData.text || ''
  };

  if (!task.comments) task.comments = [];
  task.comments.push(newComment);
  task.history.push({
    action: `Comment added by ${newComment.author}`,
    timestamp: newComment.time,
    actor: newComment.author
  });

  DSAR_SUBTASKS_MAP.set(requestId, tasks);
  return { success: true, message: 'Comment posted', comment: newComment, task };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SCREEN 6: TEAM CONFIGURATION & SLA TURNAROUND MATRIX ──────────────────
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TEAMS_CONFIG = [
  {
    id: 'team_privacy',
    name: 'Privacy / DPO',
    icon: '🛡️',
    membersCount: 4,
    members: ['Anil Reddy (DPO Lead)', 'Priya Sharma (Privacy Eng)', 'Kavita Rao (Compliance Analyst)', 'Deepak Verma (Audit Specialist)'],
    systems: 'All systems',
    slaDays: 3,
    description: 'Data privacy oversight, legal review, statutory approvals, and overall orchestration across jurisdictions.'
  },
  {
    id: 'team_data_eng',
    name: 'Data Engineering',
    icon: '🗄️',
    membersCount: 4,
    members: ['Alex Chen (Lead Eng)', 'Sneha Patil (Data Architect)', 'Rahul Mehra (Pipeline Eng)', 'Vikram Roy (DBA)'],
    systems: 'Data Lake, Warehouses',
    slaDays: 5,
    description: 'Data warehouse batch purging, data lake pipeline erasure, and downstream data consistency.'
  },
  {
    id: 'team_crm',
    name: 'CRM / Customer Data',
    icon: '👥',
    membersCount: 5,
    members: ['John Tan (Lead)', 'Sarah Lee (CRM Specialist)', 'Michael Wong (Support Admin)', 'Meera Nair (Ops)', 'David Kim (Analyst)'],
    systems: 'Salesforce, CRM',
    slaDays: 4,
    description: 'Customer records, support interaction tickets, contact preferences, and CRM account deletion.'
  },
  {
    id: 'team_hr',
    name: 'HR',
    icon: '🏢',
    membersCount: 3,
    members: ['Emma Watson (HR Lead)', 'Arun Gupta (People Ops)', 'Lisa Ray (Recruitment Lead)'],
    systems: 'HRIS, Employee DB',
    slaDays: 4,
    description: 'Internal employee archives, candidate resumes, payroll records, and access logs.'
  },
  {
    id: 'team_marketing',
    name: 'Marketing',
    icon: '📢',
    membersCount: 4,
    members: ['Lisa Wang (Marketing Lead)', 'Tom Jenkins (Campaign Mgr)', 'Sunita Rao (Email Ops)', 'Kevin Hall (Growth Eng)'],
    systems: 'Email, Campaigns',
    slaDays: 5,
    description: 'Marketing opt-outs, tracking pixels, ad identifier suppression, and campaign distribution lists.'
  },
  {
    id: 'team_legal',
    name: 'Legal',
    icon: '⚖️',
    membersCount: 2,
    members: ['Vikram Malhotra (Lead Legal Counsel)', 'Shreya Kapoor (Regulatory Counsel)'],
    systems: 'Legal Records',
    slaDays: 7,
    description: 'Statutory hold review, tax/accounting retention verification, and legal defense readiness.'
  },
  {
    id: 'team_vendor',
    name: 'Third-Party / Vendor Mgmt',
    icon: '🤝',
    membersCount: 3,
    members: ['Marcus Brody (Vendor Lead)', 'Anita Desai (Procurement)', 'Rohan Iyer (Security Auditor)'],
    systems: 'Vendors, Partners',
    slaDays: 6,
    description: 'Downstream vendor deletion cascades, sub-processor notifications, and partner confirmation logs.'
  },
  {
    id: 'team_security',
    name: 'Security',
    icon: '🔒',
    membersCount: 2,
    members: ['Farhan Ali (SecOps Lead)', 'Elena Rostova (Incident Lead)'],
    systems: 'Security Logs',
    slaDays: 5,
    description: 'Authentication audit logs, SIEM telemetry retention, and security credential revocations.'
  }
];

let teamsConfigStore = JSON.parse(JSON.stringify(DEFAULT_TEAMS_CONFIG));

/**
 * Screen 6: Get Teams & Responsibilities Matrix
 */
async function getTeamsConfig() {
  return {
    success: true,
    count: teamsConfigStore.length,
    teams: JSON.parse(JSON.stringify(teamsConfigStore))
  };
}

/**
 * Screen 6: Update Team Configuration (e.g. SLA turnaround days, member counts, systems)
 */
async function updateTeamConfig(teamId, updates = {}) {
  const teamIndex = teamsConfigStore.findIndex(t => t.id === teamId || t.name.toLowerCase() === teamId.toLowerCase());
  if (teamIndex === -1) {
    return { success: false, notFound: true, message: `Team configuration '${teamId}' not found.` };
  }

  const team = teamsConfigStore[teamIndex];
  if (updates.slaDays !== undefined) {
    const slaNum = parseInt(updates.slaDays, 10);
    if (!isNaN(slaNum) && slaNum > 0) {
      team.slaDays = slaNum;
    }
  }
  if (updates.membersCount !== undefined) {
    const countNum = parseInt(updates.membersCount, 10);
    if (!isNaN(countNum) && countNum >= 0) {
      team.membersCount = countNum;
    }
  }
  if (updates.systems !== undefined && typeof updates.systems === 'string') {
    team.systems = updates.systems;
  }
  if (updates.name !== undefined && typeof updates.name === 'string' && updates.name.trim()) {
    team.name = updates.name.trim();
  }
  if (updates.icon !== undefined && typeof updates.icon === 'string') {
    team.icon = updates.icon;
  }
  if (updates.description !== undefined && typeof updates.description === 'string') {
    team.description = updates.description;
  }
  if (Array.isArray(updates.members)) {
    team.members = updates.members;
    team.membersCount = updates.members.length;
  }

  return {
    success: true,
    message: `Team '${team.name}' updated successfully`,
    team: JSON.parse(JSON.stringify(team))
  };
}

/**
 * Screen 6: Create New Custom Team Configuration
 */
async function createTeamConfig(teamData = {}) {
  if (!teamData.name || !teamData.name.trim()) {
    return { success: false, message: 'Team name is required.' };
  }

  const teamId = `team_${Date.now()}_${teamData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const newTeam = {
    id: teamId,
    name: teamData.name.trim(),
    icon: teamData.icon || '👥',
    membersCount: parseInt(teamData.membersCount, 10) || (Array.isArray(teamData.members) ? teamData.members.length : 3),
    members: Array.isArray(teamData.members) && teamData.members.length > 0 ? teamData.members : [`${teamData.name.trim()} Lead`, 'Team Specialist'],
    systems: teamData.systems || 'Internal Systems',
    slaDays: parseInt(teamData.slaDays, 10) || 5,
    description: teamData.description || 'Departmental privacy and data compliance team.'
  };

  teamsConfigStore.push(newTeam);
  return {
    success: true,
    message: `Team '${newTeam.name}' created successfully`,
    team: JSON.parse(JSON.stringify(newTeam))
  };
}

/**
 * Screen 6: Reset Teams Configuration to Default 8 Master Teams
 */
async function resetTeamsConfig() {
  teamsConfigStore = JSON.parse(JSON.stringify(DEFAULT_TEAMS_CONFIG));
  return {
    success: true,
    message: 'Teams configuration reset to default 8 master department teams',
    count: teamsConfigStore.length,
    teams: JSON.parse(JSON.stringify(teamsConfigStore))
  };
}

module.exports = {
  createDsarRequest,
  getDsarRequests,
  getDsarRequestById,
  updateDsarTask,
  getDsarComplianceReports,
  exportDsarComplianceCsv,
  resetDsarRequests,
  generateDsarTrackingId,
  normalizeRequestType,
  generateCrossTeamTasks,
  getDsarTicketDetails,
  updateDsarSubtask,
  submitDsarApproval,
  exportDsarTasksCsv,
  getTaskAssignmentOverview,
  getIndividualSubtaskDetail,
  toggleSubtaskInstruction,
  addSubtaskEvidence,
  addSubtaskComment,
  getTeamsConfig,
  updateTeamConfig,
  createTeamConfig,
  resetTeamsConfig
};
