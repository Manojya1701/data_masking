'use strict';

const dsarService = require('../backend/services/dsar-service');

describe('DSAR Detail View & Cross-Team Tasks (Screen 3)', () => {
  const testReqId = 'DSAR-2026-000125';

  describe('Cross-Team Task Generation', () => {
    test('generateCrossTeamTasks() returns 6 department tasks with valid schema', () => {
      const tasks = dsarService.generateCrossTeamTasks(testReqId, 'Deletion', 'John Smith');
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(6);

      const expectedTeams = ['CRM Team', 'HR Team', 'Marketing Team', 'Data Engineering', 'Vendor Mgmt', 'Privacy Team'];
      const teams = tasks.map(t => t.team);
      expectedTeams.forEach(expected => {
        expect(teams).toContain(expected);
      });

      tasks.forEach(t => {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('task');
        expect(t).toHaveProperty('team');
        expect(t).toHaveProperty('assignee');
        expect(t).toHaveProperty('priority');
        expect(t).toHaveProperty('due_date');
        expect(t).toHaveProperty('systems');
        expect(t).toHaveProperty('status');
      });
    });

    test('generateCrossTeamTasks() assigns realistic department leads', () => {
      const tasks = dsarService.generateCrossTeamTasks(testReqId);
      const crmTask = tasks.find(t => t.team === 'CRM Team');
      const hrTask = tasks.find(t => t.team === 'HR Team');
      const privacyTask = tasks.find(t => t.team === 'Privacy Team');

      expect(crmTask.assignee).toBe('John Tan');
      expect(hrTask.assignee).toBe('Priya Sharma');
      expect(privacyTask.assignee).toBe('Anil Reddy');
    });
  });

  describe('Ticket Details & 7-Tab Navigation Hub Data', () => {
    test('getDsarTicketDetails() returns all 7 tab datasets', async () => {
      const res = await dsarService.getDsarTicketDetails(testReqId);
      expect(res.success).toBe(true);
      expect(res.requestId).toBe(testReqId);
      expect(res).toHaveProperty('overview');
      expect(res).toHaveProperty('requester');
      expect(res).toHaveProperty('tasks');
      expect(res).toHaveProperty('approvals');
      expect(res).toHaveProperty('communications');
      expect(res).toHaveProperty('auditLog');

      expect(res.tasks.length).toBe(6);
      expect(res.overview.totalStages).toBe(6);
      expect(Array.isArray(res.auditLog)).toBe(true);
      expect(res.auditLog.length).toBeGreaterThan(0);
    });

    test('getDsarTicketDetails() includes requester dossier with verification evidence', async () => {
      const res = await dsarService.getDsarTicketDetails(testReqId);
      expect(res.success).toBe(true);
      expect(res.requester).toBeDefined();
      expect(res.requester.fullName).toBeTruthy();
      expect(res.requester.email).toBeTruthy();
      expect(res.requester.verificationEvidence).toBeTruthy();
    });

    test('getDsarTicketDetails() includes approvals status and officers', async () => {
      const res = await dsarService.getDsarTicketDetails(testReqId);
      expect(res.approvals).toBeDefined();
      expect(res.approvals.dpoApproval).toBeDefined();
      expect(res.approvals.legalApproval).toBeDefined();
      expect(res.approvals.legalApproval.status).toBe('APPROVED');
    });
  });

  describe('Subtask Lifecycle Updates', () => {
    test('updateDsarSubtask() updates status and sets completed_at timestamp', async () => {
      const updateRes = await dsarService.updateDsarSubtask(testReqId, 'task_1', {
        status: 'Completed'
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.task.status).toBe('Completed');
      expect(updateRes.task.completed_at).toBeTruthy();
    });

    test('updateDsarSubtask() returns notFound for invalid task ID', async () => {
      const updateRes = await dsarService.updateDsarSubtask(testReqId, 'task_999', {
        status: 'In Progress'
      });
      expect(updateRes.success).toBe(false);
      expect(updateRes.notFound).toBe(true);
    });
  });

  describe('DPO Statutory Approval Workflow', () => {
    test('submitDsarApproval() records DPO approval and attestations', async () => {
      const approvalRes = await dsarService.submitDsarApproval(testReqId, {
        role: 'dpoApproval',
        status: 'APPROVED',
        signedBy: 'Anil Reddy (Chief DPO)'
      });
      expect(approvalRes.success).toBe(true);
      expect(approvalRes.approvals.dpoApproval.status).toBe('APPROVED');
      expect(approvalRes.approvals.dpoApproval.signedBy).toBe('Anil Reddy (Chief DPO)');
      expect(approvalRes.approvals.dpoApproval.signedAt).toBeTruthy();
    });
  });

  describe('CSV Export of Departmental Tasks', () => {
    test('exportDsarTasksCsv() formats tasks into CSV with header and valid rows', async () => {
      const csv = await dsarService.exportDsarTasksCsv(testReqId);
      expect(typeof csv).toBe('string');
      const lines = csv.trim().split('\n');
      expect(lines.length).toBe(7); // 1 header + 6 tasks
      expect(lines[0]).toContain('Task ID,Task Name,Department / Team,Lead Assignee,Priority,Due Date,Connected Systems,Status,Completed Timestamp');
      expect(lines[1]).toContain('CRM Team');
    });
  });
});
