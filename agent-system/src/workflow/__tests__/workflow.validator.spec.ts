import { WorkflowValidator } from '../validators/workflow.validator';
import {
  WorkflowDefinition,
  WorkflowNode,
  NodeType,
  WorkflowStatus
} from '../entities/workflow-definition.entity';

describe('WorkflowValidator', () => {
  let validator: WorkflowValidator;

  beforeEach(() => {
    validator = new WorkflowValidator();
  });

  describe('validate - Basic Fields', () => {
    it('should pass validation for valid workflow definition', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.validate(definition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when workflowId is missing', () => {
      const definition = createValidWorkflowDefinition();
      definition.workflowId = '';

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_WORKFLOW_ID',
          path: 'workflowId'
        })
      );
    });

    it('should fail when name is missing', () => {
      const definition = createValidWorkflowDefinition();
      definition.name = '';

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_NAME',
          path: 'name'
        })
      );
    });

    it('should fail when version is invalid', () => {
      const definition = createValidWorkflowDefinition();
      definition.version = 'invalid';

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_VERSION',
          path: 'version'
        })
      );
    });

    it('should fail when ownerId is missing', () => {
      const definition = createValidWorkflowDefinition();
      definition.ownerId = '';

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_OWNER',
          path: 'ownerId'
        })
      );
    });
  });

  describe('validate - Nodes', () => {
    it('should fail when nodes array is empty', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [];

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NO_NODES',
          path: 'nodes'
        })
      );
    });

    it('should fail when duplicate node IDs exist', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes.push({
        ...definition.nodes[0],
        name: 'Duplicate Node'
      });

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DUPLICATE_NODE_ID',
          path: `nodes.${definition.nodes[0].nodeId}`
        })
      );
    });

    it('should fail when start node is missing', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = definition.nodes.filter(n => n.type !== NodeType.START);

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NO_START_NODE',
          path: 'nodes'
        })
      );
    });

    it('should fail when end node is missing', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = definition.nodes.filter(n => n.type !== NodeType.END);

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NO_END_NODE',
          path: 'nodes'
        })
      );
    });

    it('should fail when node references non-existent dependency', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[1].dependencies = ['non-existent-node'];

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_DEPENDENCY',
          path: `nodes.${definition.nodes[1].nodeId}.dependencies`
        })
      );
    });

    it('should fail when node timeout is invalid', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[0].timeout = -100;

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TIMEOUT',
          path: `nodes.${definition.nodes[0].nodeId}.timeout`
        })
      );
    });
  });

  describe('detectCycles', () => {
    it('should detect simple circular dependency', () => {
      const definition = createValidWorkflowDefinition();
      // A -> B -> C -> A (circular)
      definition.nodes[1].dependencies = [definition.nodes[2].nodeId];
      definition.nodes[2].dependencies = [definition.nodes[1].nodeId];

      const result = validator.detectCycles(definition);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('should detect complex circular dependency', () => {
      const definition = createValidWorkflowDefinition();
      // A -> B -> C -> D -> B (circular)
      const nodeB = definition.nodes[1];
      const nodeC = definition.nodes[2];
      const nodeD: WorkflowNode = {
        nodeId: 'node-d',
        name: 'Node D',
        type: NodeType.CODE,
        dependencies: [nodeC.nodeId],
        dependents: []
      };
      definition.nodes.push(nodeD);
      nodeB.dependencies.push(nodeD.nodeId);

      const result = validator.detectCycles(definition);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('should return empty array for valid DAG', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.detectCycles(definition);

      expect(result).toHaveLength(0);
    });

    it('should detect multiple independent cycles', () => {
      const definition = createValidWorkflowDefinition();
      // Cycle 1: A -> B -> A
      definition.nodes[1].dependencies = [definition.nodes[0].nodeId, definition.nodes[2].nodeId];
      definition.nodes[0].dependencies = [definition.nodes[1].nodeId];

      const result = validator.detectCycles(definition);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('validate - Isolated Nodes', () => {
    it('should fail when node is isolated (no connections)', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes.push({
        nodeId: 'isolated-node',
        name: 'Isolated Node',
        type: NodeType.CODE,
        dependencies: [],
        dependents: []
      });

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'ISOLATED_NODE',
          path: 'nodes.isolated-node'
        })
      );
    });
  });
});

// Helper function to create valid workflow definition
function createValidWorkflowDefinition(): WorkflowDefinition {
  const startNode: WorkflowNode = {
    nodeId: 'start',
    name: 'Start',
    type: NodeType.START,
    dependencies: [],
    dependents: ['node-a']
  };

  const nodeA: WorkflowNode = {
    nodeId: 'node-a',
    name: 'Node A',
    type: NodeType.CODE,
    dependencies: ['start'],
    dependents: ['node-b'],
    timeout: 30000
  };

  const nodeB: WorkflowNode = {
    nodeId: 'node-b',
    name: 'Node B',
    type: NodeType.CODE,
    dependencies: ['node-a'],
    dependents: ['end']
  };

  const endNode: WorkflowNode = {
    nodeId: 'end',
    name: 'End',
    type: NodeType.END,
    dependencies: ['node-b'],
    dependents: []
  };

  return {
    workflowId: 'wf-test-001',
    name: 'Test Workflow',
    description: 'A test workflow',
    version: '1.0.0',
    status: WorkflowStatus.DRAFT,
    ownerId: 'user-001',
    tags: ['test'],
    nodes: [startNode, nodeA, nodeB, endNode],
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1
  };
}
