import { SubflowNodeExecutor } from '../executors/subflow.executor';
import { NodeType, WorkflowNode, WorkflowDefinition } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';
import { NodeExecutorRegistry } from '../executors/executor.registry';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { DAGExecutor } from '../executors/dag.executor';

describe('SubflowNodeExecutor', () => {
  let executor: SubflowNodeExecutor;
  let context: NodeExecutionContextImpl;
  let registry: NodeExecutorRegistry;
  let workflowRepo: jest.Mocked<WorkflowRepository>;
  let dagExecutor: jest.Mocked<DAGExecutor>;

  beforeEach(() => {
    registry = new NodeExecutorRegistry();
    workflowRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<WorkflowRepository>;
    dagExecutor = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<DAGExecutor>;
    executor = new SubflowNodeExecutor(registry, workflowRepo, dagExecutor);
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'subflow-node',
      { userId: '123', orderId: '456' },
      {}
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('type', () => {
    it('should have SUBFLOW type', () => {
      expect(executor.type).toBe(NodeType.SUBFLOW);
    });
  });

  describe('execute - sync invocation', () => {
    it('should execute subflow and wait for completion', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          {
            nodeId: 'start',
            name: 'Start',
            type: NodeType.START,
            dependencies: [],
            dependents: ['end'],
            config: {}
          },
          {
            nodeId: 'end',
            name: 'End',
            type: NodeType.END,
            dependencies: ['start'],
            dependents: [],
            config: {}
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { result: 'success' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(workflowRepo.findById).toHaveBeenCalledWith('subflow-1');
    });

    it('should map parameters to subflow', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { processedUserId: '123' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: [
              { source: 'userId', target: 'subflowUserId' }
            ]
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
    });

    it('should map results back to parent context', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { result: 'processed' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: [
              { source: 'result', target: 'subflowResult' }
            ]
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(context.getVariable('subflowResult')).toBe('processed');
    });
  });

  describe('execute - async invocation', () => {
    it('should start subflow and return reference', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { executionId: 'async-exec-001' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow Async',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'async',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.subflowExecutionId).toBeDefined();
    });
  });

  describe('execute - error handling', () => {
    it('should propagate errors when configured', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: false,
        error: { code: 'SUBFLOW_ERROR', message: 'Subflow failed' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          },
          errorHandling: {
            strategy: 'propagate'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUBFLOW_ERROR');
    });

    it('should catch errors when configured', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: false,
        error: { code: 'SUBFLOW_ERROR', message: 'Subflow failed' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          },
          errorHandling: {
            strategy: 'catch',
            errorVariablePath: 'subflowError'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(context.getVariable('subflowError')).toBeDefined();
    });

    it('should use fallback value on error when configured', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: false,
        error: { code: 'SUBFLOW_ERROR', message: 'Subflow failed' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          },
          errorHandling: {
            strategy: 'fallback',
            fallbackValue: { defaultResult: true }
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.results).toEqual({ defaultResult: true });
    });
  });

  describe('execute - validation errors', () => {
    it('should handle missing subflow definition', async () => {
      workflowRepo.findById.mockResolvedValue(null);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'non-existent',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUBFLOW_NOT_FOUND');
    });

    it('should handle missing subflowId', async () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFIG_ERROR');
    });
  });

  describe('execute - parameter mapping', () => {
    it('should map parameters with transform', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { result: 'success' }
      } as any);

      // Set source variable
      context.setVariable('inputValue', 'hello');

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: [
              { source: 'inputValue', target: 'outputValue', transform: 'value.toUpperCase()' }
            ]
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
    });

    it('should handle static parameters', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { result: 'success' }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: [],
            staticParams: {
              env: 'test',
              version: '1.0'
            }
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
    });

    it('should handle execution error', async () => {
      workflowRepo.findById.mockRejectedValue(new Error('Database error'));

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUBFLOW_EXECUTION_ERROR');
    });
  });

  describe('execute - result mapping', () => {
    it('should map entire output when configured', async () => {
      const mockWorkflow: WorkflowDefinition = {
        workflowId: 'subflow-1',
        name: 'Test Subflow',
        version: '1',
        status: 'active' as any,
        ownerId: 'test-user',
        schemaVersion: 1,
        nodes: [
          { nodeId: 'start', name: 'Start', type: NodeType.START, dependencies: [], dependents: ['end'], config: {} },
          { nodeId: 'end', name: 'End', type: NodeType.END, dependencies: ['start'], dependents: [], config: {} }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      workflowRepo.findById.mockResolvedValue(mockWorkflow);
      dagExecutor.execute.mockResolvedValue({
        success: true,
        output: { data: { nested: 'value' } }
      } as any);

      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: [],
            mapEntireOutput: true,
            outputVariablePath: 'fullResult'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(context.getVariable('fullResult')).toEqual({ data: { nested: 'value' } });
    });
  });

  describe('validate', () => {
    it('should validate valid subflow node', () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'sync',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(true);
    });

    it('should require subflowId', () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('subflowId is required');
    });

    it('should require parameters', () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1'
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parameters is required');
    });

    it('should require resultMapping', () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          parameters: {
            mapping: []
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resultMapping is required');
    });

    it('should validate invocation mode', () => {
      const node: WorkflowNode = {
        nodeId: 'subflow-node',
        name: 'Call Subflow',
        type: NodeType.SUBFLOW,
        dependencies: [],
        dependents: [],
        config: {
          subflowId: 'subflow-1',
          invocationMode: 'invalid',
          parameters: {
            mapping: []
          },
          resultMapping: {
            outputs: []
          }
        }
      };

      const result = executor.validate!(node);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e: string) => e.includes('invocationMode'))).toBe(true);
    });
  });
});
