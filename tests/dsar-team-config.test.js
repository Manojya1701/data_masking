'use strict';

const dsarService = require('../backend/services/dsar-service');

describe('Screen 6: Team Configuration & SLA Turnaround Matrix', () => {

  beforeEach(async () => {
    await dsarService.resetTeamsConfig();
  });

  describe('getTeamsConfig()', () => {
    test('should return all 8 default master department teams matching Screen 6 diagram', async () => {
      const res = await dsarService.getTeamsConfig();
      expect(res.success).toBe(true);
      expect(res.count).toBe(8);
      expect(Array.isArray(res.teams)).toBe(true);
      expect(res.teams.length).toBe(8);

      const teamNames = res.teams.map(t => t.name);
      expect(teamNames).toContain('Privacy / DPO');
      expect(teamNames).toContain('Data Engineering');
      expect(teamNames).toContain('CRM / Customer Data');
      expect(teamNames).toContain('HR');
      expect(teamNames).toContain('Marketing');
      expect(teamNames).toContain('Legal');
      expect(teamNames).toContain('Third-Party / Vendor Mgmt');
      expect(teamNames).toContain('Security');

      const privacyTeam = res.teams.find(t => t.id === 'team_privacy');
      expect(privacyTeam).toBeDefined();
      expect(privacyTeam.slaDays).toBe(3);
      expect(privacyTeam.membersCount).toBe(4);
      expect(privacyTeam.systems).toBe('All systems');
      expect(privacyTeam.icon).toBe('🛡️');

      const legalTeam = res.teams.find(t => t.id === 'team_legal');
      expect(legalTeam).toBeDefined();
      expect(legalTeam.slaDays).toBe(7);
      expect(legalTeam.membersCount).toBe(2);
    });
  });

  describe('updateTeamConfig()', () => {
    test('should update SLA turnaround days for a specific team', async () => {
      const res = await dsarService.updateTeamConfig('team_privacy', { slaDays: 2 });
      expect(res.success).toBe(true);
      expect(res.team.slaDays).toBe(2);

      const check = await dsarService.getTeamsConfig();
      const privacy = check.teams.find(t => t.id === 'team_privacy');
      expect(privacy.slaDays).toBe(2);
    });

    test('should update members count and systems for a team', async () => {
      const res = await dsarService.updateTeamConfig('team_crm', {
        membersCount: 7,
        systems: 'Salesforce, CRM DB, Hubspot'
      });
      expect(res.success).toBe(true);
      expect(res.team.membersCount).toBe(7);
      expect(res.team.systems).toBe('Salesforce, CRM DB, Hubspot');
    });

    test('should return notFound for invalid team ID', async () => {
      const res = await dsarService.updateTeamConfig('non_existent_team_xyz', { slaDays: 10 });
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    });
  });

  describe('createTeamConfig()', () => {
    test('should register a new custom department team', async () => {
      const newTeamData = {
        name: 'Fraud & Anti-Money Laundering',
        icon: '🕵️',
        membersCount: 3,
        slaDays: 4,
        systems: 'Fraud DB, Transaction Logs',
        description: 'Verifies financial crime and regulatory exceptions.'
      };

      const res = await dsarService.createTeamConfig(newTeamData);
      expect(res.success).toBe(true);
      expect(res.team.name).toBe('Fraud & Anti-Money Laundering');
      expect(res.team.slaDays).toBe(4);
      expect(res.team.icon).toBe('🕵️');
      expect(res.team.membersCount).toBe(3);

      const check = await dsarService.getTeamsConfig();
      expect(check.count).toBe(9);
      expect(check.teams.some(t => t.name === 'Fraud & Anti-Money Laundering')).toBe(true);
    });

    test('should reject creation without a team name', async () => {
      const res = await dsarService.createTeamConfig({ slaDays: 5 });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Team name is required');
    });
  });

  describe('resetTeamsConfig()', () => {
    test('should restore defaults after modifications and additions', async () => {
      await dsarService.updateTeamConfig('team_privacy', { slaDays: 20 });
      await dsarService.createTeamConfig({ name: 'Temporary Department' });

      let check = await dsarService.getTeamsConfig();
      expect(check.count).toBe(9);

      const resetRes = await dsarService.resetTeamsConfig();
      expect(resetRes.success).toBe(true);
      expect(resetRes.count).toBe(8);

      check = await dsarService.getTeamsConfig();
      expect(check.count).toBe(8);
      const privacy = check.teams.find(t => t.id === 'team_privacy');
      expect(privacy.slaDays).toBe(3);
    });
  });

});
