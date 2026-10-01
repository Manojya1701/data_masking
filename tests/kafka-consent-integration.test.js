'use strict';

/**
 * Segmento Event & Integration Layer: Kafka Streaming & Downstream Enforcement Test Suite
 * Validates:
 * 1. Kafka Broker Topic Initialization & Partition Hashing (by subject_id key)
 * 2. Producer Event Publishing & Header Propagation (x-correlation-id)
 * 3. 5 Downstream Connector Consumers (CRM, Marketing, Snowflake, AI/ML, Third-Party)
 * 4. Consumer Group Offset Commits & Consumer Lag Tracking
 * 5. Dead Letter Queue (DLQ) Fallback on Connector Processing Errors
 * 6. Kafka Stream Replay Capabilities for Regulatory Audits
 * 7. Consent Service Integration & Kafka Metric Inspection
 */

const kafkaService = require('../backend/services/kafka-service');
const kafkaConsumers = require('../backend/services/kafka-consumers');
const consentService = require('../backend/services/consent-service');

describe('Kafka Streaming & Downstream Enforcement Integration (End-to-End)', () => {
  const testSubject = 'auditor.kafka@example.com';

  beforeAll(async () => {
    // Ensure initial subject state exists
    consentService.getConsentStatus(testSubject);
  });

  describe('1. Kafka Cluster Broker & Partition Hashing', () => {
    test('should initialize Kafka cluster with 3 default topics and 3 partitions each', () => {
      const metrics = kafkaService.getClusterMetrics();
      expect(metrics.status).toBe('HEALTHY');
      expect(metrics.totalTopics).toBeGreaterThanOrEqual(3);
      expect(metrics.topics.map(t => t.topic)).toContain('consent.events.withdrawal');
      expect(metrics.topics.map(t => t.topic)).toContain('consent.events.grant');
      expect(metrics.topics.map(t => t.topic)).toContain('consent.events.dlq');

      const withdrawalTopic = metrics.topics.find(t => t.topic === 'consent.events.withdrawal');
      expect(withdrawalTopic.partitionsCount).toBe(3);
    });

    test('should deterministically assign partition IDs based on message key hash', () => {
      const p1 = kafkaService._getPartitionForKey('user-alpha@example.com');
      const p2 = kafkaService._getPartitionForKey('user-alpha@example.com');
      const p3 = kafkaService._getPartitionForKey('user-beta@example.com');

      expect(p1).toBe(p2);
      expect(typeof p1).toBe('number');
      expect(p1).toBeGreaterThanOrEqual(0);
      expect(p1).toBeLessThan(3);
      expect(typeof p3).toBe('number');
    });
  });

  describe('2. Kafka Producer & Event Publishing', () => {
    test('should publish withdrawal event to Kafka with correlation headers', async () => {
      const result = await kafkaService.publishEvent({
        topic: 'consent.events.withdrawal',
        key: 'subject-101@example.com',
        value: {
          subjectId: 'subject-101@example.com',
          withdrawnCategories: ['AI_MODEL_TRAINING', 'MARKETING_COMMUNICATIONS'],
          reason: 'Automated test revocation'
        },
        headers: {
          'x-correlation-id': 'corr-test-12345',
          'schema-version': '1.0.0'
        }
      });

      expect(result.success).toBe(true);
      expect(result.topic).toBe('consent.events.withdrawal');
      expect(typeof result.partition).toBe('number');
      expect(typeof result.offset).toBe('number');
      expect(result.eventId).toMatch(/^evt_/);
      expect(result.correlationId).toBe('corr-test-12345');
    });

    test('should capture published events in event stream log', () => {
      const stream = kafkaService.getEventStream({ topic: 'consent.events.withdrawal', limit: 10 });
      expect(Array.isArray(stream)).toBe(true);
      expect(stream.length).toBeGreaterThan(0);
      expect(stream[0].status).toBe('ACK_COMMITTED');
    });
  });

  describe('3. 5 Downstream Connector Consumers Execution', () => {
    test('should register all 5 downstream connector consumers with online status', () => {
      const connectors = kafkaConsumers.getConnectorStatuses();
      expect(connectors.length).toBe(5);

      const ids = connectors.map(c => c.id);
      expect(ids).toContain('connector-crm');
      expect(ids).toContain('connector-marketing');
      expect(ids).toContain('connector-datalake');
      expect(ids).toContain('connector-aiml');
      expect(ids).toContain('connector-thirdparty');

      connectors.forEach(c => {
        expect(c.status).toBe('ONLINE');
      });
    });

    test('should trigger all 5 downstream connectors upon consent withdrawal', async () => {
      const prevLedgerLen = kafkaConsumers.getEnforcementLedger().length;

      // Execute consent withdrawal via consent service
      const withdrawResult = await consentService.withdrawConsent({
        identifier: 'kafka.test.subject@example.com',
        categories: ['AI_MODEL_TRAINING', 'MARKETING_COMMUNICATIONS', 'BEHAVIORAL_TRACKING'],
        reason: 'Downstream enforcement verification',
        requestedVia: 'TEST_SUITE'
      });

      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.kafkaEvent).toBeDefined();
      expect(withdrawResult.kafkaEvent.topic).toBe('consent.events.withdrawal');

      // Wait a tick for async event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedLedger = kafkaConsumers.getEnforcementLedger();
      expect(updatedLedger.length).toBeGreaterThan(prevLedgerLen);

      // Verify specific connector actions
      const actions = updatedLedger.map(l => l.action);
      expect(actions).toContain('CRM_SUPPRESSION_FLAGS_UPDATED');
      expect(actions).toContain('MARKETING_LIST_SUPPRESSION');
      expect(actions).toContain('TELEMETRY_STREAM_MUTED_AND_PURGED');
      expect(actions).toContain('AI_TRAINING_EXCLUSION_COMMITTED');
      expect(actions).toContain('PARTNER_OPT_OUT_WEBHOOK_DISPATCHED');

      // Verify AI Training Exclusion Token format (EU AI Act)
      const aimlEntry = updatedLedger.find(l => l.action === 'AI_TRAINING_EXCLUSION_COMMITTED');
      expect(aimlEntry).toBeDefined();
      expect(aimlEntry.exclusionToken).toMatch(/^EXCL-AI-/);
    });
  });

  describe('4. Dead Letter Queue (DLQ) Fallback & Error Handling', () => {
    test('should route message to DLQ when a consumer handler throws an error', async () => {
      // Subscribe a faulty consumer
      kafkaService.subscribeConsumer({
        groupId: 'faulty-test-consumer-group',
        topics: ['consent.events.withdrawal'],
        handler: async () => {
          throw new Error('Simulated connector connection timeout (DLQ test)');
        }
      });

      // Publish an event that triggers the faulty consumer
      await kafkaService.publishEvent({
        topic: 'consent.events.withdrawal',
        key: 'faulty-subject@example.com',
        value: { action: 'trigger_dlq' }
      });

      // Wait a tick for async DLQ routing
      await new Promise(resolve => setTimeout(resolve, 50));

      const dlqEvents = kafkaService.getEventStream({ topic: 'consent.events.dlq' });
      expect(dlqEvents.length).toBeGreaterThan(0);
      expect(dlqEvents[0].value.failedInGroup).toBe('faulty-test-consumer-group');
      expect(dlqEvents[0].value.errorMessage).toContain('Simulated connector connection timeout');
    });
  });

  describe('5. Stream Replay Capabilities', () => {
    test('should replay events from offset 0 across all consumer groups', async () => {
      const replayResult = await kafkaService.replayEvents('consent.events.withdrawal', 0);
      expect(replayResult.success).toBe(true);
      expect(replayResult.replayedCount).toBeGreaterThan(0);
      expect(replayResult.topic).toBe('consent.events.withdrawal');
    });
  });

  describe('6. Consent Service Kafka Proxy Methods', () => {
    test('should retrieve cluster metrics and consumer groups via consentService', () => {
      const metrics = consentService.getKafkaMetrics();
      expect(metrics.status).toBe('HEALTHY');
      expect(Array.isArray(metrics.consumerGroups)).toBe(true);
      expect(metrics.consumerGroups.length).toBeGreaterThanOrEqual(5);
    });

    test('should retrieve live event stream via consentService', () => {
      const events = consentService.getKafkaEvents({ limit: 10 });
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should retrieve downstream connector states via consentService', () => {
      const connectors = consentService.getDownstreamConnectors();
      expect(connectors.length).toBe(5);
    });

    test('should retrieve enforcement ledger via consentService', () => {
      const ledger = consentService.getEnforcementLedger(10);
      expect(Array.isArray(ledger)).toBe(true);
      expect(ledger.length).toBeGreaterThan(0);
    });

    test('should publish grant event to consent.events.grant topic upon re-grant', async () => {
      const grantResult = await consentService.grantConsent({
        identifier: 'kafka.test.subject@example.com',
        categories: ['MARKETING_COMMUNICATIONS'],
        reason: 'Re-grant test'
      });

      expect(grantResult.success).toBe(true);
      expect(grantResult.kafkaEvent).toBeDefined();
      expect(grantResult.kafkaEvent.topic).toBe('consent.events.grant');
    });
  });
});
