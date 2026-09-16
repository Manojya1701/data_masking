'use strict';

const dsarService = require('../backend/services/dsar-service');

describe('DSAR Team Assignment & Task Detail Workspace (Screens 4 & 5)', () => {
  const testReqId = 'DSAR-2026-000125';

  describe('Screen 4: Team Assignment & Task Distribution', () => {
    test('getTaskAssignmentOverview() returns 6 teams with leads and assigned tasks', async () => {
      const res = await dsarService.getTaskAssignmentOverview(testReqId);
      expect(res.success).toBe(true);
      expect(res.requestId).toBe(testReqId);
      expect(res.banner).toBeDefined();
      expect(res.banner.tasksCount).toBe(6);
      expect(res.banner.teamsCount).toBe(6);
      expect(Array.isArray(res.teams)).toBe(true);
      expect(res.teams.length).toBe(6);

      const crmTeam = res.teams.find(t => t.team === 'CRM Team');
      expect(crmTeam).toBeDefined();
      expect(crmTeam.lead).toContain('John Tan');
      expect(crmTeam.assignedTask).toBe('Find customer records');
      expect(crmTeam.systems).toBeTruthy();
    });

    test('getTaskAssignmentOverview() returns notFound for invalid request ID', async () => {
      const res = await dsarService.getTaskAssignmentOverview('DSAR-NONEXISTENT-999999');
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    });
  });

  describe('Screen 5: Individual Task Workspace Details', () => {
    test('getIndividualSubtaskDetail() returns task metadata, instructions, evidence, comments, and history', async () => {
      const res = await dsarService.getIndividualSubtaskDetail(testReqId, 'task_1');
      expect(res.success).toBe(true);
      expect(res.task).toBeDefined();
      expect(res.task.id).toBe('task_1');
      expect(res.task.task).toBe('Find customer records');
      expect(res.task.assignee).toBe('John Tan');
      expect(res.task.priority).toBe('High');
      expect(res.task.dataSources).toBeTruthy();
      expect(res.task.systems).toBeTruthy();

      // Check 4 inner tabs datasets
      expect(Array.isArray(res.task.instructions)).toBe(true);
      expect(res.task.instructions.length).toBeGreaterThan(0);

      expect(Array.isArray(res.task.evidence)).toBe(true);
      expect(Array.isArray(res.task.comments)).toBe(true);
      expect(Array.isArray(res.task.history)).toBe(true);
    });

    test('toggleSubtaskInstruction() updates checklist item completion status', async () => {
      const res = await dsarService.toggleSubtaskInstruction(testReqId, 'task_1', 0, true);
      expect(res.success).toBe(true);
      expect(res.task.instructions[0].done).toBe(true);

      const res2 = await dsarService.toggleSubtaskInstruction(testReqId, 'task_1', 0, false);
      expect(res2.success).toBe(true);
      expect(res2.task.instructions[0].done).toBe(false);
    });

    test('addSubtaskEvidence() attaches evidence attachment and updates audit history', async () => {
      const evRes = await dsarService.addSubtaskEvidence(testReqId, 'task_1', {
        name: 'test_database_dump.csv',
        size: '45.2 KB',
        uploadedBy: 'John Tan'
      });
      expect(evRes.success).toBe(true);
      expect(evRes.evidence.name).toBe('test_database_dump.csv');
      expect(evRes.task.evidence.some(e => e.name === 'test_database_dump.csv')).toBe(true);
      expect(evRes.task.history.some(h => h.action.includes('test_database_dump.csv'))).toBe(true);
    });

    test('addSubtaskComment() adds operator note and updates audit history', async () => {
      const cmtRes = await dsarService.addSubtaskComment(testReqId, 'task_1', {
        text: 'All matching records purged from Salesforce replica.',
        author: 'John Tan',
        role: 'CRM Lead'
      });
      expect(cmtRes.success).toBe(true);
      expect(cmtRes.comment.text).toBe('All matching records purged from Salesforce replica.');
      expect(cmtRes.task.comments.some(c => c.text.includes('Salesforce replica'))).toBe(true);
    });

    test('updateDsarSubtask() marks subtask as Completed', async () => {
      const updateRes = await dsarService.updateDsarSubtask(testReqId, 'task_1', {
        status: 'Completed'
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.task.status).toBe('Completed');
      expect(updateRes.task.completed_at).toBeTruthy();
    });
  });
});
