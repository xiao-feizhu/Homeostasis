import {
  VersionManager,
  SemanticVersion,
  VersionStatus,
} from '../versioning/version.manager';

describe('SemanticVersion', () => {
  describe('parse', () => {
    it('should parse valid semantic version', () => {
      const version = SemanticVersion.parse('1.2.3');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it('should parse version with pre-release', () => {
      const version = SemanticVersion.parse('1.2.3-beta.1');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.prerelease).toBe('beta.1');
    });

    it('should throw error for invalid version', () => {
      expect(() => SemanticVersion.parse('invalid')).toThrow();
      expect(() => SemanticVersion.parse('1.2')).toThrow();
    });
  });

  describe('toString', () => {
    it('should convert to string', () => {
      const version = new SemanticVersion(1, 2, 3);
      expect(version.toString()).toBe('1.2.3');
    });

    it('should include pre-release', () => {
      const version = new SemanticVersion(1, 2, 3, 'beta.1');
      expect(version.toString()).toBe('1.2.3-beta.1');
    });
  });

  describe('compare', () => {
    it('should compare major versions', () => {
      const v1 = new SemanticVersion(2, 0, 0);
      const v2 = new SemanticVersion(1, 9, 9);
      expect(v1.compare(v2)).toBeGreaterThan(0);
      expect(v2.compare(v1)).toBeLessThan(0);
    });

    it('should compare minor versions', () => {
      const v1 = new SemanticVersion(1, 5, 0);
      const v2 = new SemanticVersion(1, 4, 9);
      expect(v1.compare(v2)).toBeGreaterThan(0);
    });

    it('should compare patch versions', () => {
      const v1 = new SemanticVersion(1, 0, 5);
      const v2 = new SemanticVersion(1, 0, 4);
      expect(v1.compare(v2)).toBeGreaterThan(0);
    });

    it('should return 0 for equal versions', () => {
      const v1 = new SemanticVersion(1, 2, 3);
      const v2 = new SemanticVersion(1, 2, 3);
      expect(v1.compare(v2)).toBe(0);
    });

    it('should treat pre-release as lower', () => {
      const v1 = new SemanticVersion(1, 0, 0);
      const v2 = new SemanticVersion(1, 0, 0, 'beta');
      expect(v1.compare(v2)).toBeGreaterThan(0);
    });
  });

  describe('bump', () => {
    it('should bump major version', () => {
      const version = new SemanticVersion(1, 2, 3);
      const bumped = version.bump('major');
      expect(bumped.toString()).toBe('2.0.0');
    });

    it('should bump minor version', () => {
      const version = new SemanticVersion(1, 2, 3);
      const bumped = version.bump('minor');
      expect(bumped.toString()).toBe('1.3.0');
    });

    it('should bump patch version', () => {
      const version = new SemanticVersion(1, 2, 3);
      const bumped = version.bump('patch');
      expect(bumped.toString()).toBe('1.2.4');
    });
  });
});

describe('VersionManager', () => {
  let manager: VersionManager;

  beforeEach(() => {
    manager = new VersionManager();
  });

  describe('createVersion', () => {
    it('should create initial version', async () => {
      const metadata = await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test Workflow', nodes: [] },
        createdBy: 'user-001',
        changeDescription: 'Initial version',
      });

      expect(metadata.version).toBe('1.0.0');
      expect(metadata.workflowId).toBe('wf-001');
      expect(metadata.status).toBe(VersionStatus.DRAFT);
    });

    it('should auto-increment version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      await manager.publishVersion('wf-001', '1.0.0');

      const metadata2 = await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
        bumpType: 'minor',
      });

      expect(metadata2.version).toBe('1.1.0');
    });

    it('should reject duplicate version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      await expect(
        manager.createVersion({
          workflowId: 'wf-001',
          definition: { name: 'Test', nodes: [] },
          createdBy: 'user-001',
          version: '1.0.0',
        })
      ).rejects.toThrow(/already exists/);
    });
  });

  describe('publishVersion', () => {
    it('should publish draft version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      const published = await manager.publishVersion('wf-001', '1.0.0');
      expect(published.status).toBe(VersionStatus.PUBLISHED);
      expect(published.publishedAt).toBeDefined();
    });

    it('should reject publishing non-existent version', async () => {
      await expect(
        manager.publishVersion('wf-001', '1.0.0')
      ).rejects.toThrow(/not found/);
    });

    it('should reject publishing already published version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      await manager.publishVersion('wf-001', '1.0.0');

      await expect(
        manager.publishVersion('wf-001', '1.0.0')
      ).rejects.toThrow(/not in draft status/);
    });
  });

  describe('getVersion', () => {
    it('should retrieve version metadata', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
        changeDescription: 'Initial version',
      });

      const metadata = await manager.getVersion('wf-001', '1.0.0');
      expect(metadata).toBeDefined();
      expect(metadata?.version).toBe('1.0.0');
      expect(metadata?.changeDescription).toBe('Initial version');
    });

    it('should return null for non-existent version', async () => {
      const metadata = await manager.getVersion('wf-001', '1.0.0');
      expect(metadata).toBeNull();
    });
  });

  describe('getVersions', () => {
    it('should list all versions for workflow', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      await manager.publishVersion('wf-001', '1.0.0');

      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
        bumpType: 'minor',
      });

      const versions = await manager.getVersions('wf-001');
      expect(versions).toHaveLength(2);
    });

    it('should filter by status', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      await manager.publishVersion('wf-001', '1.0.0');

      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
        bumpType: 'minor',
      });

      const published = await manager.getVersions('wf-001', { status: VersionStatus.PUBLISHED });
      expect(published).toHaveLength(1);
      expect(published[0].status).toBe(VersionStatus.PUBLISHED);
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest published version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });
      await manager.publishVersion('wf-001', '1.0.0');

      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
        bumpType: 'major',
      });
      await manager.publishVersion('wf-001', '2.0.0');

      const latest = await manager.getLatestVersion('wf-001');
      expect(latest?.version).toBe('2.0.0');
    });

    it('should return null if no published versions', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      const latest = await manager.getLatestVersion('wf-001');
      expect(latest).toBeNull();
    });
  });

  describe('deprecateVersion', () => {
    it('should deprecate published version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });
      await manager.publishVersion('wf-001', '1.0.0');

      const deprecated = await manager.deprecateVersion('wf-001', '1.0.0', 'Use v2 instead');
      expect(deprecated.status).toBe(VersionStatus.DEPRECATED);
      expect(deprecated.deprecationReason).toBe('Use v2 instead');
    });
  });

  describe('archiveVersion', () => {
    it('should archive version', async () => {
      await manager.createVersion({
        workflowId: 'wf-001',
        definition: { name: 'Test', nodes: [] },
        createdBy: 'user-001',
      });

      const archived = await manager.archiveVersion('wf-001', '1.0.0');
      expect(archived.status).toBe(VersionStatus.ARCHIVED);
    });
  });
});
