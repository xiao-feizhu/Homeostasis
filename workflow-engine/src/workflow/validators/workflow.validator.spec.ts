import { WorkflowValidator } from './workflow.validator';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  DataSchema,
} from '../types/workflow.types';

describe('WorkflowValidator', () => {
  let validator: WorkflowValidator;

  beforeEach(() => {
    validator = new WorkflowValidator();
  });

  describe('validate', () => {
    it('should return valid for a valid workflow definition', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.validate(definition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for empty nodes array', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [];

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes',
          code: 'EMPTY_NODES',
        }),
      );
    });

    it('should return errors for duplicate node IDs', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes.push({ ...definition.nodes[0] });

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes',
          code: 'DUPLICATE_NODE_IDS',
        }),
      );
    });

    it('should return errors for missing start node', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = definition.nodes.filter(
        (n) => n.type !== WorkflowNodeType.START,
      );

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes',
          code: 'MISSING_START_NODE',
        }),
      );
    });

    it('should return errors for multiple start nodes', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes.push({
        id: 'start2',
        type: WorkflowNodeType.START,
        name: 'Second Start',
        dependencies: [],
      });

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes',
          code: 'MULTIPLE_START_NODES',
        }),
      );
    });
  });

  describe('validateNodeCompleteness', () => {
    it('should return valid for complete nodes', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.validateNodeCompleteness(definition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for node with empty ID', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[0].id = '';

      const result = validator.validateNodeCompleteness(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes[0].id',
          code: 'EMPTY_NODE_ID',
        }),
      );
    });

    it('should return errors for node with empty name', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[0].name = '';

      const result = validator.validateNodeCompleteness(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes[0].name',
          code: 'EMPTY_NODE_NAME',
        }),
      );
    });

    it('should return errors for undefined dependencies', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[1].dependencies = undefined as unknown as string[];

      const result = validator.validateNodeCompleteness(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes[1].dependencies',
          code: 'UNDEFINED_DEPENDENCIES',
        }),
      );
    });

    it('should return errors for non-array dependencies', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[1].dependencies = 'invalid' as unknown as string[];

      const result = validator.validateNodeCompleteness(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes[1].dependencies',
          code: 'INVALID_DEPENDENCIES_TYPE',
        }),
      );
    });
  });

  describe('validateNoCycles', () => {
    it('should return valid for DAG workflow', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.validateNoCycles(definition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect direct cycle (A -> B -> A)', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [
        createNode('A', WorkflowNodeType.START, []),
        createNode('B', WorkflowNodeType.TASK, ['A']),
      ];
      definition.edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ];

      const result = validator.validateNoCycles(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'edges',
          code: 'CYCLE_DETECTED',
        }),
      );
    });

    it('should detect indirect cycle (A -> B -> C -> A)', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes = [
        createNode('A', WorkflowNodeType.START, []),
        createNode('B', WorkflowNodeType.TASK, ['A']),
        createNode('C', WorkflowNodeType.TASK, ['B']),
      ];
      definition.edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ];

      const result = validator.validateNoCycles(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'edges',
          code: 'CYCLE_DETECTED',
        }),
      );
    });

    it('should detect self-loop', () => {
      const definition = createValidWorkflowDefinition();
      definition.edges.push({ from: 'task1', to: 'task1' });

      const result = validator.validateNoCycles(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'edges',
          code: 'CYCLE_DETECTED',
        }),
      );
    });

    it('should return valid for disconnected components without cycles', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes.push({
        id: 'isolated',
        type: WorkflowNodeType.TASK,
        name: 'Isolated Task',
        dependencies: [],
      });

      const result = validator.validateNoCycles(definition);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateInputOutputTypes', () => {
    it('should return valid for valid schemas', () => {
      const definition = createValidWorkflowDefinition();

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing workflow input schema', () => {
      const definition = createValidWorkflowDefinition();
      definition.inputSchema = undefined as unknown as DataSchema;

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'inputSchema',
          code: 'MISSING_INPUT_SCHEMA',
        }),
      );
    });

    it('should return errors for missing workflow output schema', () => {
      const definition = createValidWorkflowDefinition();
      definition.outputSchema = undefined as unknown as DataSchema;

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputSchema',
          code: 'MISSING_OUTPUT_SCHEMA',
        }),
      );
    });

    it('should return errors for invalid schema type', () => {
      const definition = createValidWorkflowDefinition();
      definition.inputSchema = { type: 'invalid' as 'string' };

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'inputSchema.type',
          code: 'INVALID_SCHEMA_TYPE',
        }),
      );
    });

    it('should return errors for node with invalid input schema', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[1].inputSchema = { type: 'invalid' as 'string' };

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'nodes[1].inputSchema.type',
          code: 'INVALID_SCHEMA_TYPE',
        }),
      );
    });

    it('should allow undefined node schemas (optional)', () => {
      const definition = createValidWorkflowDefinition();
      definition.nodes[1].inputSchema = undefined;
      definition.nodes[1].outputSchema = undefined;

      const result = validator.validateInputOutputTypes(definition);

      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null definition', () => {
      const result = validator.validate(null as unknown as WorkflowDefinition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'definition',
          code: 'NULL_DEFINITION',
        }),
      );
    });

    it('should handle undefined definition', () => {
      const result = validator.validate(undefined as unknown as WorkflowDefinition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'definition',
          code: 'NULL_DEFINITION',
        }),
      );
    });

    it('should handle empty workflow ID', () => {
      const definition = createValidWorkflowDefinition();
      definition.id = '';

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'id',
          code: 'EMPTY_WORKFLOW_ID',
        }),
      );
    });

    it('should handle invalid edge references', () => {
      const definition = createValidWorkflowDefinition();
      definition.edges.push({ from: 'nonexistent', to: 'task1' });

      const result = validator.validate(definition);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'edges',
          code: 'INVALID_EDGE_REFERENCE',
        }),
      );
    });
  });
});

// Helper functions
function createNode(
  id: string,
  type: WorkflowNodeType,
  dependencies: string[],
): WorkflowNode {
  return {
    id,
    type,
    name: `${type} Node ${id}`,
    dependencies,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
  };
}

function createValidWorkflowDefinition(): WorkflowDefinition {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    nodes: [
      createNode('start', WorkflowNodeType.START, []),
      createNode('task1', WorkflowNodeType.TASK, ['start']),
      createNode('task2', WorkflowNodeType.TASK, ['task1']),
      createNode('end', WorkflowNodeType.END, ['task2']),
    ],
    edges: [
      { from: 'start', to: 'task1' },
      { from: 'task1', to: 'task2' },
      { from: 'task2', to: 'end' },
    ],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    },
  };
}
