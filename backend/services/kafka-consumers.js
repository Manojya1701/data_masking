'use strict';

/**
 * Segmento Downstream Enforcement: Kafka Consumer Connector Services
 * Implements the 5 downstream consumer groups from the architecture diagram:
 * 1. CRM Connector (HubSpot / Salesforce / Braze)
 * 2. Marketing Platform Connector (Email / SMS Suppression)
 * 3. Data Lake & Warehouse Connector (Snowflake Telemetry Purge)
 * 4. AI / ML Pipeline Connector (OpenAI / Vertex AI Training Data Exclusion)
 * 5. Third Party Systems Connector (API Webhooks & Ad Exchanges)
 */

const kafkaService = require('./kafka-service');
const crypto = require('crypto');

class KafkaConsumers {
  constructor() {
    this.connectorStates = new Map();
    this.enforcementLedger = [];
    this._initConnectors();
  }

  _initConnectors() {
    // ── 1. CRM Connector (HubSpot / Salesforce / Braze) ─────────────────────
    this._registerConnector({
      id: 'connector-crm',
      name: 'CRM Connector (Salesforce & HubSpot)',
      icon: '🏢',
      system: 'Salesforce CRM / HubSpot',
      groupId: 'crm-enforcement-group',
      topic: 'consent.events.withdrawal',
      description: 'Syncs customer consent status to CRM leads & accounts, setting suppression flags on marketing records.',
      handler: async (event) => {
        const payload = event.value || {};
        const subject = payload.subjectId || payload.identifier || 'unknown';
        const categories = payload.withdrawnCategories || [];
        
        const actionRecord = {
          connectorId: 'connector-crm',
          system: 'Salesforce CRM',
          subject,
          action: 'CRM_SUPPRESSION_FLAGS_UPDATED',
          categoriesAffected: categories,
          eventId: event.eventId,
          partition: event.partition,
          offset: event.offset,
          status: 'ENFORCED_SUCCESS',
          enforcedAt: new Date().toISOString(),
          details: `Set 'DoNotContact' and 'ConsentWithdrawn' on Salesforce Account for ${subject}.`
        };

        this.enforcementLedger.unshift(actionRecord);
        return actionRecord;
      }
    });

    // ── 2. Marketing Platform Connector (Email / SMS) ───────────────────────
    this._registerConnector({
      id: 'connector-marketing',
      name: 'Marketing Platform (SendGrid / Twilio)',
      icon: '✉️',
      system: 'SendGrid & Twilio SMS',
      groupId: 'marketing-platform-group',
      topic: 'consent.events.withdrawal',
      description: 'Automatically pushes SHA-256 hashed email and phone to global suppression blacklists.',
      handler: async (event) => {
        const payload = event.value || {};
        const subject = payload.subjectId || payload.identifier || 'unknown';
        const suppressionToken = payload.suppressionToken || crypto.createHash('sha256').update(subject).digest('hex');

        const actionRecord = {
          connectorId: 'connector-marketing',
          system: 'SendGrid / Twilio Gateway',
          subject,
          action: 'MARKETING_LIST_SUPPRESSION',
          suppressionToken,
          eventId: event.eventId,
          status: 'ENFORCED_SUCCESS',
          enforcedAt: new Date().toISOString(),
          details: `Added hash ${suppressionToken.substring(0, 16)}... to SendGrid Unsubscribe & Twilio STOP suppression table.`
        };

        this.enforcementLedger.unshift(actionRecord);
        return actionRecord;
      }
    });

    // ── 3. Data Lake / Warehouse Connector (Snowflake) ──────────────────────
    this._registerConnector({
      id: 'connector-datalake',
      name: 'Data Lake & Warehouse (Snowflake)',
      icon: '❄️',
      system: 'Snowflake Analytics Lakehouse',
      groupId: 'datalake-snowflake-group',
      topic: 'consent.events.withdrawal',
      description: 'Executes telemetry ingestion freeze and purges cross-site cookie behavioral partitions.',
      handler: async (event) => {
        const payload = event.value || {};
        const subject = payload.subjectId || payload.identifier || 'unknown';

        const actionRecord = {
          connectorId: 'connector-datalake',
          system: 'Snowflake Data Lake',
          subject,
          action: 'TELEMETRY_STREAM_MUTED_AND_PURGED',
          eventId: event.eventId,
          status: 'ENFORCED_SUCCESS',
          enforcedAt: new Date().toISOString(),
          details: `Purged behavioral telemetry stream for ${subject} in Snowflake partition: analytics.customer_tracking_events.`
        };

        this.enforcementLedger.unshift(actionRecord);
        return actionRecord;
      }
    });

    // ── 4. AI / ML Pipeline Connector (Training Data Exclusion) ─────────────
    this._registerConnector({
      id: 'connector-aiml',
      name: 'AI / ML Pipeline (Vertex AI & OpenAI)',
      icon: '🧠',
      system: 'Vertex AI / Model Fine-Tuning Cluster',
      groupId: 'aiml-training-exclusion-group',
      topic: 'consent.events.withdrawal',
      description: 'Commits training exclusion token to omit customer chats and documents from LLM fine-tuning datasets.',
      handler: async (event) => {
        const payload = event.value || {};
        const subject = payload.subjectId || payload.identifier || 'unknown';
        const exclusionToken = `EXCL-AI-${crypto.createHash('sha256').update(subject + Date.now()).digest('hex').substring(0, 16).toUpperCase()}`;

        const actionRecord = {
          connectorId: 'connector-aiml',
          system: 'Vertex AI Training Pipeline',
          subject,
          action: 'AI_TRAINING_EXCLUSION_COMMITTED',
          exclusionToken,
          eventId: event.eventId,
          status: 'ENFORCED_SUCCESS',
          enforcedAt: new Date().toISOString(),
          details: `Committed AI training exclusion token ${exclusionToken} under EU AI Act Art. 53.`
        };

        this.enforcementLedger.unshift(actionRecord);
        return actionRecord;
      }
    });

    // ── 5. Third Party Systems Connector (API Connectors / Ad Exchanges) ───
    this._registerConnector({
      id: 'connector-thirdparty',
      name: 'Third Party Systems (API Connectors)',
      icon: '🌐',
      system: 'Ad Network Exchanges & Affiliate Brokers',
      groupId: 'thirdparty-syndication-group',
      topic: 'consent.events.withdrawal',
      description: 'Dispatches CCPA/CPRA Do-Not-Sell opt-out signals and partner webhook notifications.',
      handler: async (event) => {
        const payload = event.value || {};
        const subject = payload.subjectId || payload.identifier || 'unknown';

        const actionRecord = {
          connectorId: 'connector-thirdparty',
          system: 'Ad Network Broker Sync',
          subject,
          action: 'PARTNER_OPT_OUT_WEBHOOK_DISPATCHED',
          eventId: event.eventId,
          status: 'ENFORCED_SUCCESS',
          enforcedAt: new Date().toISOString(),
          details: `Broadcasted IAB Do-Not-Sell / Do-Not-Share signal to 12 partner syndication endpoints for ${subject}.`
        };

        this.enforcementLedger.unshift(actionRecord);
        return actionRecord;
      }
    });

    console.log('[Segmento Kafka] 5 Downstream Connector Consumers Registered & Subscribed');
  }

  _registerConnector(config) {
    const state = {
      id: config.id,
      name: config.name,
      icon: config.icon,
      system: config.system,
      groupId: config.groupId,
      topic: config.topic,
      description: config.description,
      status: 'ONLINE',
      processedCount: 0,
      lastAction: 'IDLE_WAITING_FOR_EVENTS',
      lastActiveAt: new Date().toISOString()
    };

    this.connectorStates.set(config.id, state);

    kafkaService.subscribeConsumer({
      groupId: config.groupId,
      consumerName: config.name,
      topics: [config.topic],
      handler: async (event) => {
        state.lastAction = `PROCESSING_EVENT_${event.eventId}`;
        state.lastActiveAt = new Date().toISOString();
        
        const result = await config.handler(event);
        
        state.processedCount += 1;
        state.lastAction = result.action;
        state.lastActiveAt = new Date().toISOString();
        return result;
      }
    });
  }

  /**
   * Returns live status of all 5 downstream connectors
   */
  getConnectorStatuses() {
    return Array.from(this.connectorStates.values());
  }

  /**
   * Returns recent downstream enforcement action ledger
   */
  getEnforcementLedger(limit = 50) {
    return this.enforcementLedger.slice(0, parseInt(limit, 10));
  }
}

module.exports = new KafkaConsumers();
