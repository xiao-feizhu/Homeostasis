import {
  VersionComparator,
  ChangeType,
} from '../versioning/version.comparator';
import { WorkflowNode, NodeType } from '../entities/workflow-definition.entity';

describe('VersionComparator', () => {
  let comparator: VersionComparator;

  beforeEach(() => {
    comparator = new VersionComparator();
  });

  describe('compare', () => {
    it('should detect added nodes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['end'],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {},
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);

      expect(diff.changes).toHaveLength(1);
      expect(diff.changes[0].type).toBe(ChangeType.ADDED);
      expect(diff.changes[0].nodeId).toBe('end');
    });

    it('should detect removed nodes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['middle'],
          config: {},
        },
        {
          nodeId: 'middle',
          name: 'Middle',
          type: NodeType.CODE,
          dependencies: ['start'],
          dependents: ['end'],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['middle'],
          dependents: [],
          config: {},
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['end'],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {},
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);

      const removedChanges = diff.changes.filter(c => c.type === ChangeType.REMOVED);
      expect(removedChanges).toHaveLength(1);
      expect(removedChanges[0].nodeId).toBe('middle');
    });

    it('should detect modified nodes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'code',
          name: 'Code',
          type: NodeType.CODE,
          dependencies: [],
          dependents: [],
          config: { language: 'javascript', code: 'return 1;' },
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'code',
          name: 'Code',
          type: NodeType.CODE,
          dependencies: [],
          dependents: [],
          config: { language: 'javascript', code: 'return 2;' },
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);

      expect(diff.changes).toHaveLength(1);
      expect(diff.changes[0].type).toBe(ChangeType.MODIFIED);
      expect(diff.changes[0].nodeId).toBe('code');
    });

    it('should detect dependency changes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: [],
          dependents: [],
          config: {},
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['end'],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {},
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);

      // Should detect dependency changes as modifications
      const depChanges = diff.changes.filter((c: any) => c.type === ChangeType.MODIFIED);
      expect(depChanges.length).toBeGreaterThan(0);
    });

    it('should calculate breaking changes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'api',
          name: 'API',
          type: NodeType.API,
          dependencies: [],
          dependents: [],
          config: { endpoint: '/api/v1/users' },
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'api',
          name: 'API',
          type: NodeType.API,
          dependencies: [],
          dependents: [],
          config: { endpoint: '/api/v2/users' },
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);

      expect(diff.breakingChanges).toBeGreaterThan(0);
    });

    it('should detect no changes for identical workflows', () => {
      const nodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
      ];

      const diff = comparator.compare(nodes, nodes);

      expect(diff.changes).toHaveLength(0);
      expect(diff.isCompatible).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate human-readable report', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {},
        },
      ];

      const diff = comparator.compare(oldNodes, newNodes);
      const report = comparator.generateReport(diff);

      expect(report).toContain('Added');
      expect(report).toContain('End');
    });
  });

  describe('checkCompatibility', () => {
    it('should return true for backward compatible changes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: [],
          config: {},
        },
        {
          nodeId: 'log',
          name: 'Log',
          type: NodeType.CODE,
          dependencies: ['start'],
          dependents: [],
          config: {},
        },
      ];

      const isCompatible = comparator.checkCompatibility(oldNodes, newNodes);

      expect(isCompatible).toBe(true);
    });

    it('should return false for breaking changes', () => {
      const oldNodes: WorkflowNode[] = [
        {
          nodeId: 'api',
          name: 'API',
          type: NodeType.API,
          dependencies: [],
          dependents: [],
          config: { method: 'GET' },
        },
      ];

      const newNodes: WorkflowNode[] = [
        {
          nodeId: 'api',
          name: 'API',
          type: NodeType.API,
          dependencies: [],
          dependents: [],
          config: { method: 'POST' },
        },
      ];

      const isCompatible = comparator.checkCompatibility(oldNodes, newNodes);

      expect(isCompatible).toBe(false);
    });
  });
});
