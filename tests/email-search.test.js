'use strict';

/**
 * Unit Tests for Global Database Email Search Service
 * Verifies searching for emails across all database tables (privacy_deletion_customers, customers, protected_customer_data),
 * match count aggregation, non-existent email handling, and input validation.
 */

const { searchEmailInDatabase, DB_TABLE_REGISTRY } = require('../backend/services/email-search-service');

describe('Global Database Email Search Service', () => {

  test('searchEmailInDatabase returns matches for existing email across database tables', async () => {
    const res = await searchEmailInDatabase('rahul@gmail.com');
    expect(res).toHaveProperty('success', true);
    expect(res).toHaveProperty('email', 'rahul@gmail.com');
    expect(res).toHaveProperty('found', true);
    expect(res.totalMatches).toBeGreaterThan(0);
    expect(res.tableMatchesCount).toBeGreaterThan(0);
    expect(Array.isArray(res.matches)).toBe(true);

    const match = res.matches.find(m => m.tableName === 'privacy_deletion_customers');
    expect(match).toBeDefined();
    expect(match.matchCount).toBeGreaterThan(0);
    expect(match.records.some(r => r.email === 'rahul@gmail.com')).toBe(true);
  });

  test('searchEmailInDatabase returns found: false for non-existent email', async () => {
    const res = await searchEmailInDatabase('random_non_existent_user_999@example.com');
    expect(res).toHaveProperty('success', true);
    expect(res).toHaveProperty('found', false);
    expect(res.totalMatches).toBe(0);
    expect(res.tableMatchesCount).toBe(0);
    expect(res.matches.length).toBe(0);
  });

  test('searchEmailInDatabase throws error for empty email query', async () => {
    await expect(searchEmailInDatabase('')).rejects.toThrow(/Email query parameter is required/i);
    await expect(searchEmailInDatabase('   ')).rejects.toThrow(/Email query parameter is required/i);
  });

  test('DB_TABLE_REGISTRY contains all primary database tables', () => {
    expect(Array.isArray(DB_TABLE_REGISTRY)).toBe(true);
    expect(DB_TABLE_REGISTRY.length).toBeGreaterThan(1);
    const tableNames = DB_TABLE_REGISTRY.map(t => t.tableName);
    expect(tableNames).toContain('privacy_deletion_customers');
    expect(tableNames).toContain('customers');
    expect(tableNames).toContain('protected_customer_data');
  });

});
