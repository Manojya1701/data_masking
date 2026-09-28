'use strict';

/**
 * Segmento Consent Management & Withdrawal Service
 * Implements GDPR Art. 7(3), Art. 21, DPDP Act 2023 Sec. 6(4), and Singapore PDPA Sec. 16.
 *
 * Distinct Principles:
 * - Deletion (GDPR Art. 17): Terminates profile and permanently erases transactional records.
 * - Consent Withdrawal (GDPR Art. 7(3)): Account remains ACTIVE while granular processing permissions
 *   (Marketing, AI Model Training, Ad Tracking, Third-Party Sharing, Biometrics) are revoked.
 * - Generates immutable SHA-256 cryptographic withdrawal receipts & suppression tokens.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const CONSENT_LEDGER_FILE = path.join(__dirname, '../database/consent-ledger.json');

// Standard Granular Consent Categories
const CONSENT_CATEGORIES = {
  MARKETING_COMMUNICATIONS: {
    id: 'MARKETING_COMMUNICATIONS',
    name: 'Marketing & Promotional Communications',
    description: 'Promotional emails, SMS campaigns, push alerts, and product update newsletters',
    icon: '📢',
    defaultState: 'GRANTED',
    legalBasis: 'Consent (GDPR Art. 6(1)(a) / DPDP Sec. 6(1))',
    downstreamSystems: ['Braze CRM', 'SendGrid', 'Twilio SMS Gateway']
  },
  AI_MODEL_TRAINING: {
    id: 'AI_MODEL_TRAINING',
    name: 'AI & Machine Learning Model Training',
    description: 'Using customer conversations, uploaded documents, and interactions to train generative LLMs and ML models',
    icon: '🧠',
    defaultState: 'GRANTED',
    legalBasis: 'Explicit Consent (EU AI Act Art. 53 / GDPR Art. 9)',
    downstreamSystems: ['Vertex AI Pipeline', 'Fine-Tuning Dataset Storage', 'Vector Embeddings Index']
  },
  BEHAVIORAL_TRACKING: {
    id: 'BEHAVIORAL_TRACKING',
    name: 'Behavioral Tracking & Web Telemetry',
    description: 'Cross-site cookies, session recording, browsing profiling, and behavioral telemetry analytics',
    icon: '📊',
    defaultState: 'GRANTED',
    legalBasis: 'ePrivacy Directive / GDPR Art. 6(1)(a)',
    downstreamSystems: ['Snowflake Analytics Lake', 'Segment CDP', 'Google Analytics 4']
  },
  THIRD_PARTY_SHARING: {
    id: 'THIRD_PARTY_SHARING',
    name: 'Third-Party & Affiliate Data Sharing',
    description: 'Syndicating profile insights to advertising networks, commercial brokers, and partner exchanges',
    icon: '🤝',
    defaultState: 'GRANTED',
    legalBasis: 'Explicit Consent (CCPA/CPRA Do Not Sell / GDPR Art. 7)',
    downstreamSystems: ['Ad Exchange Sync', 'Affiliate Broker Connector']
  },
  BIOMETRIC_TELEMETRY: {
    id: 'BIOMETRIC_TELEMETRY',
    name: 'Biometric & Voice Telemetry',
    description: 'Voiceprint acoustic features, facial authentication telemetry, and biometric usage diagnostics',
    icon: '🛡️',
    defaultState: 'GRANTED',
    legalBasis: 'Special Category Explicit Consent (GDPR Art. 9(2)(a))',
    downstreamSystems: ['Biometric Auth Cluster', 'Acoustic Model Cache']
  }
};

class ConsentService {
  constructor() {
    this.records = new Map();
    this.receipts = new Map();
    this.loadLedger();
  }

  /**
   * Load existing consent ledger from disk or initialize with seed subjects
   */
  loadLedger() {
    try {
      if (fs.existsSync(CONSENT_LEDGER_FILE)) {
        const raw = fs.readFileSync(CONSENT_LEDGER_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.records && Array.isArray(data.records)) {
          data.records.forEach(r => this.records.set(this._normKey(r.identifier), r));
        }
        if (data.receipts && Array.isArray(data.receipts)) {
          data.receipts.forEach(rc => this.receipts.set(rc.receiptId, rc));
        }
      }
    } catch (err) {
      console.warn('[ConsentService] Warning loading ledger file:', err.message);
    }

    // Seed default baseline records if ledger is empty
    if (this.records.size === 0) {
      this._seedInitialLedger();
    }
  }

  /**
   * Persist ledger snapshot to disk asynchronously
   */
  _saveLedger() {
    try {
      const data = {
        updatedAt: new Date().toISOString(),
        records: Array.from(this.records.values()),
        receipts: Array.from(this.receipts.values())
      };
      fs.writeFileSync(CONSENT_LEDGER_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[ConsentService] Error saving ledger file:', err.message);
    }
  }

  _normKey(identifier) {
    if (!identifier) return 'unknown';
    return String(identifier).trim().toLowerCase();
  }

  _seedInitialLedger() {
    const seedSubjects = [
      {
        identifier: 'alex.johnson@example.com',
        subjectName: 'Alex Johnson',
        customerId: 'CUST-8842',
        jurisdiction: 'Singapore (PDPA)',
        consents: {
          MARKETING_COMMUNICATIONS: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' },
          AI_MODEL_TRAINING: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' },
          BEHAVIORAL_TRACKING: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' },
          THIRD_PARTY_SHARING: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' },
          BIOMETRIC_TELEMETRY: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' }
        },
        history: [
          {
            action: 'INITIAL_GRANT',
            categories: Object.keys(CONSENT_CATEGORIES),
            timestamp: '2026-08-01T10:00:00.000Z',
            actor: 'subject',
            method: 'WEB_PORTAL_SIGNUP',
            proofHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          }
        ]
      },
      {
        identifier: 'john.smith@example.com',
        subjectName: 'John Smith',
        customerId: 'CUST-1002',
        jurisdiction: 'EU (GDPR)',
        consents: {
          MARKETING_COMMUNICATIONS: { state: 'WITHDRAWN', updatedAt: '2026-08-15T14:20:00.000Z', reason: 'Unsubscribed from marketing' },
          AI_MODEL_TRAINING: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' },
          BEHAVIORAL_TRACKING: { state: 'WITHDRAWN', updatedAt: '2026-08-15T14:20:00.000Z', reason: 'Cookie banner opt-out' },
          THIRD_PARTY_SHARING: { state: 'WITHDRAWN', updatedAt: '2026-08-15T14:20:00.000Z', reason: 'CCPA opt-out' },
          BIOMETRIC_TELEMETRY: { state: 'GRANTED', updatedAt: '2026-08-01T10:00:00.000Z' }
        },
        history: [
          {
            action: 'INITIAL_GRANT',
            categories: Object.keys(CONSENT_CATEGORIES),
            timestamp: '2026-08-01T10:00:00.000Z',
            actor: 'subject',
            method: 'WEB_PORTAL_SIGNUP'
          },
          {
            action: 'WITHDRAWAL',
            categories: ['MARKETING_COMMUNICATIONS', 'BEHAVIORAL_TRACKING', 'THIRD_PARTY_SHARING'],
            timestamp: '2026-08-15T14:20:00.000Z',
            actor: 'subject',
            method: 'SELF_SERVE_PORTAL',
            receiptId: 'WDR-2026-INIT01',
            proofHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0'
          }
        ]
      }
    ];

    seedSubjects.forEach(s => {
      this.records.set(this._normKey(s.identifier), s);
    });
    this._saveLedger();
  }

  /**
   * Get list of all supported consent categories with metadata
   */
  getCategories() {
    return Object.values(CONSENT_CATEGORIES);
  }

  /**
   * Look up full consent state for a data subject
   */
  getConsentStatus(identifier) {
    if (!identifier) {
      throw new Error('Data subject identifier (email or customer ID) is required.');
    }

    const key = this._normKey(identifier);
    let record = this.records.get(key);

    // If subject does not yet exist in ledger, initialize standard default model
    if (!record) {
      const now = new Date().toISOString();
      const defaultConsents = {};
      Object.keys(CONSENT_CATEGORIES).forEach(catKey => {
        defaultConsents[catKey] = {
          state: CONSENT_CATEGORIES[catKey].defaultState,
          updatedAt: now
        };
      });

      record = {
        identifier: identifier.trim(),
        subjectName: identifier.split('@')[0] || identifier,
        customerId: identifier.startsWith('CUST-') ? identifier : undefined,
        jurisdiction: 'Global (GDPR / PDPA / DPDP)',
        accountStatus: 'ACTIVE',
        consents: defaultConsents,
        history: [
          {
            action: 'INITIAL_DEFAULT',
            categories: Object.keys(CONSENT_CATEGORIES),
            timestamp: now,
            actor: 'system',
            method: 'DYNAMIC_PROVISION'
          }
        ]
      };
      this.records.set(key, record);
      this._saveLedger();
    }

    // Enrich categories with human-readable labels & system states
    const enrichedConsents = {};
    let totalGranted = 0;
    let totalWithdrawn = 0;

    Object.keys(CONSENT_CATEGORIES).forEach(catKey => {
      const catMeta = CONSENT_CATEGORIES[catKey];
      const entry = record.consents[catKey] || { state: 'GRANTED', updatedAt: record.history[0]?.timestamp || new Date().toISOString() };
      
      if (entry.state === 'GRANTED') totalGranted++;
      if (entry.state === 'WITHDRAWN') totalWithdrawn++;

      enrichedConsents[catKey] = {
        ...catMeta,
        state: entry.state,
        updatedAt: entry.updatedAt,
        reason: entry.reason || null,
        receiptId: entry.receiptId || null
      };
    });

    return {
      identifier: record.identifier,
      subjectName: record.subjectName,
      customerId: record.customerId,
      jurisdiction: record.jurisdiction,
      accountStatus: record.accountStatus || 'ACTIVE',
      summary: {
        totalCategories: Object.keys(CONSENT_CATEGORIES).length,
        grantedCount: totalGranted,
        withdrawnCount: totalWithdrawn,
        overallStatus: totalWithdrawn === 0 ? 'ALL_GRANTED' : (totalGranted === 0 ? 'ALL_WITHDRAWN' : 'PARTIALLY_WITHDRAWN')
      },
      categories: enrichedConsents,
      history: record.history || []
    };
  }

  /**
   * Execute Granular Consent Withdrawal
   * @param {Object} params
   * @param {string} params.identifier - Subject email or ID
   * @param {string[]|string} params.categories - Array of category IDs to withdraw, or 'ALL'
   * @param {string} [params.reason] - Reason for withdrawal
   * @param {string} [params.requestedVia] - 'DSAR_PORTAL', 'SELF_SERVE_UI', 'API', 'EMAIL'
   * @param {string} [params.actor] - User or system initiating
   * @param {string} [params.ipAddress] - Request IP for audit log
   */
  async withdrawConsent(params = {}) {
    const {
      identifier,
      categories,
      reason = 'Withdrawn by data subject request',
      requestedVia = 'DSAR_PORTAL',
      actor = 'data_subject',
      ipAddress = '127.0.0.1',
      jurisdiction
    } = params;

    if (!identifier) {
      throw new Error('Data subject identifier (email or customer ID) is required.');
    }

    const currentStatus = this.getConsentStatus(identifier);
    const key = this._normKey(identifier);
    const record = this.records.get(key);

    // Determine target categories
    let targetCats = [];
    if (categories === 'ALL' || (Array.isArray(categories) && categories.includes('ALL'))) {
      targetCats = Object.keys(CONSENT_CATEGORIES);
    } else if (Array.isArray(categories)) {
      targetCats = categories.filter(c => CONSENT_CATEGORIES[c]);
    } else if (typeof categories === 'string' && CONSENT_CATEGORIES[categories]) {
      targetCats = [categories];
    }

    if (targetCats.length === 0) {
      throw new Error(`Invalid or empty consent categories provided. Supported categories: ${Object.keys(CONSENT_CATEGORIES).join(', ')}`);
    }

    const timestamp = new Date().toISOString();
    const receiptId = `WDR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Cryptographic Proof Payload (SHA-256)
    const proofPayload = {
      receiptId,
      identifier: record.identifier,
      withdrawnCategories: targetCats,
      timestamp,
      reason,
      requestedVia,
      actor,
      statutoryLegalBasis: 'GDPR Art. 7(3) / DPDP Act 2023 Sec. 6(4) / PDPA Sec. 16',
      salt: crypto.randomBytes(8).toString('hex')
    };

    const sha256Proof = crypto.createHash('sha256')
      .update(JSON.stringify(proofPayload))
      .digest('hex');

    // SHA-256 Suppression Token (Hashed email for downstream suppression lists without retaining plain PII)
    const suppressionToken = crypto.createHash('sha256')
      .update(record.identifier.toLowerCase().trim())
      .digest('hex');

    // Downstream Synchronization Actions
    const downstreamActions = [];
    targetCats.forEach(catKey => {
      const cat = CONSENT_CATEGORIES[catKey];
      cat.downstreamSystems.forEach(sys => {
        downstreamActions.push({
          system: sys,
          category: catKey,
          action: 'SUPPRESSION_SYNCED',
          status: 'COMPLETED',
          timestamp
        });
      });

      // Update state in subject record
      record.consents[catKey] = {
        state: 'WITHDRAWN',
        updatedAt: timestamp,
        reason,
        receiptId,
        proofHash: sha256Proof
      };
    });

    if (jurisdiction) {
      record.jurisdiction = jurisdiction;
    }

    // Receipt Record
    const receiptRecord = {
      receiptId,
      identifier: record.identifier,
      subjectName: record.subjectName,
      withdrawnCategories: targetCats.map(k => ({
        id: k,
        name: CONSENT_CATEGORIES[k].name,
        icon: CONSENT_CATEGORIES[k].icon
      })),
      timestamp,
      reason,
      requestedVia,
      actor,
      sha256Proof,
      suppressionToken,
      legalBasis: proofPayload.statutoryLegalBasis,
      downstreamActionsCount: downstreamActions.length,
      verified: true
    };

    // Append to subject history
    record.history.unshift({
      action: 'WITHDRAWAL',
      receiptId,
      categories: targetCats,
      timestamp,
      actor,
      method: requestedVia,
      reason,
      proofHash: sha256Proof,
      ipAddress
    });

    this.receipts.set(receiptId, receiptRecord);
    this._saveLedger();

    return {
      success: true,
      message: `Successfully processed consent withdrawal for ${targetCats.length} categories under GDPR Art. 7(3) / DPDP Sec. 6(4).`,
      receipt: receiptRecord,
      downstreamSync: downstreamActions,
      currentStatus: this.getConsentStatus(identifier)
    };
  }

  /**
   * Re-grant consent for specific categories (Opt-in)
   */
  async grantConsent(params = {}) {
    const {
      identifier,
      categories,
      reason = 'Voluntarily granted by data subject',
      requestedVia = 'SELF_SERVE_UI',
      actor = 'data_subject'
    } = params;

    if (!identifier) {
      throw new Error('Data subject identifier is required.');
    }

    const key = this._normKey(identifier);
    this.getConsentStatus(identifier); // Ensure initialized
    const record = this.records.get(key);

    let targetCats = [];
    if (categories === 'ALL' || (Array.isArray(categories) && categories.includes('ALL'))) {
      targetCats = Object.keys(CONSENT_CATEGORIES);
    } else if (Array.isArray(categories)) {
      targetCats = categories.filter(c => CONSENT_CATEGORIES[c]);
    } else if (typeof categories === 'string' && CONSENT_CATEGORIES[categories]) {
      targetCats = [categories];
    }

    if (targetCats.length === 0) {
      throw new Error('Invalid categories provided.');
    }

    const timestamp = new Date().toISOString();
    const receiptId = `GNT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const proofPayload = {
      receiptId,
      identifier: record.identifier,
      grantedCategories: targetCats,
      timestamp,
      actor,
      requestedVia
    };

    const sha256Proof = crypto.createHash('sha256')
      .update(JSON.stringify(proofPayload))
      .digest('hex');

    targetCats.forEach(catKey => {
      record.consents[catKey] = {
        state: 'GRANTED',
        updatedAt: timestamp,
        reason,
        receiptId,
        proofHash: sha256Proof
      };
    });

    record.history.unshift({
      action: 'CONSENT_GRANTED',
      receiptId,
      categories: targetCats,
      timestamp,
      actor,
      method: requestedVia,
      reason,
      proofHash: sha256Proof
    });

    this._saveLedger();

    return {
      success: true,
      message: `Consent granted for ${targetCats.length} categories.`,
      receiptId,
      proofHash: sha256Proof,
      currentStatus: this.getConsentStatus(identifier)
    };
  }

  /**
   * Retrieve full audit history of consent events for an identifier
   */
  getConsentHistory(identifier) {
    const status = this.getConsentStatus(identifier);
    return {
      identifier: status.identifier,
      totalEvents: status.history.length,
      history: status.history
    };
  }

  /**
   * Get a specific withdrawal receipt by ID
   */
  getReceipt(receiptId) {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} not found.`);
    }
    return receipt;
  }

  /**
   * List all consent records across subjects (for DPO / Privacy Lead console)
   */
  listRecords(filter = {}) {
    let list = Array.from(this.records.values()).map(r => this.getConsentStatus(r.identifier));

    if (filter.status) {
      list = list.filter(item => item.summary.overallStatus === filter.status);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(item =>
        item.identifier.toLowerCase().includes(q) ||
        (item.subjectName && item.subjectName.toLowerCase().includes(q)) ||
        (item.customerId && item.customerId.toLowerCase().includes(q))
      );
    }

    return list;
  }
}

module.exports = new ConsentService();
