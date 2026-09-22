'use strict';

/**
 * Segmento Webhook Event Service
 * Dispatches and logs lifecycle events across the Data Deletion pipeline:
 * - deletion.created
 * - deletion.discovery.completed
 * - deletion.plan.created
 * - deletion.approved
 * - deletion.started
 * - deletion.system.completed
 * - deletion.failed
 * - deletion.verification.completed
 * - deletion.completed
 */

const { v4: uuidv4 } = require('uuid');

class WebhookService {
  constructor() {
    this.subscribers = new Map(); // url -> { id, url, events: [], createdAt }
    this.eventLog = []; // in-memory event buffer (capped at 500)
    this.maxLogSize = 500;
  }

  /**
   * Register a webhook subscriber
   * @param {Object} param0 { url, events: Array<string> }
   */
  subscribe({ url, events = ['*'] }) {
    if (!url) throw new Error('Webhook URL is required.');
    const id = 'sub-' + uuidv4().slice(0, 8);
    const subscriber = {
      id,
      url,
      events: Array.isArray(events) ? events : [events],
      createdAt: new Date().toISOString()
    };
    this.subscribers.set(id, subscriber);
    return subscriber;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(id) {
    return this.subscribers.delete(id);
  }

  /**
   * List all subscribers
   */
  getSubscribers() {
    return Array.from(this.subscribers.values());
  }

  /**
   * Dispatch a deletion event
   * @param {string} eventName e.g. 'deletion.completed'
   * @param {Object} payload Event details
   */
  async dispatch(eventName, payload = {}) {
    const eventId = 'evt-' + uuidv4().slice(0, 8);
    const timestamp = new Date().toISOString();

    const eventRecord = {
      event: eventName,
      eventId,
      deletionId: payload.deletionId || payload.id || null,
      requestId: payload.requestId || null,
      timestamp,
      data: payload
    };

    // Push to log buffer
    this.eventLog.unshift(eventRecord);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.pop();
    }

    // Broadcast to matching subscribers asynchronously (non-blocking)
    const matchingSubs = Array.from(this.subscribers.values()).filter(sub => {
      return sub.events.includes('*') || sub.events.includes(eventName);
    });

    for (const sub of matchingSubs) {
      this._sendToSubscriber(sub, eventRecord).catch(err => {
        console.warn(`[Webhook] Delivery to ${sub.url} failed:`, err.message);
      });
    }

    return eventRecord;
  }

  async _sendToSubscriber(sub, eventRecord) {
    if (typeof fetch !== 'function') return;
    try {
      await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Segmento-Webhook-Dispatcher/1.0',
          'X-Segmento-Event': eventRecord.event
        },
        body: JSON.stringify(eventRecord),
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
    } catch (err) {
      // Non-blocking log
    }
  }

  /**
   * Get recent event history
   */
  getEventHistory(filter = {}) {
    let list = [...this.eventLog];
    if (filter.deletionId) {
      list = list.filter(e => e.deletionId === filter.deletionId);
    }
    if (filter.event) {
      list = list.filter(e => e.event === filter.event);
    }
    if (filter.limit) {
      list = list.slice(0, parseInt(filter.limit, 10));
    }
    return list;
  }

  /**
   * Clear event log (for tests)
   */
  clearEventLog() {
    this.eventLog = [];
  }
}

module.exports = new WebhookService();
