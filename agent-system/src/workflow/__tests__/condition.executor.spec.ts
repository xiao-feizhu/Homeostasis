import { ConditionNodeExecutor } from '../executors/condition.executor';
import { NodeType, WorkflowNode } from '../entities/workflow-definition.entity';
import { NodeExecutionContextImpl } from '../executors/node.executor';

describe('ConditionNodeExecutor', () => {
  let executor: ConditionNodeExecutor;
  let context: NodeExecutionContextImpl;

  beforeEach(() => {
    executor = new ConditionNodeExecutor();
    context = new NodeExecutionContextImpl(
      'exec-001',
      'wf-001',
      'condition-node',
      {},
      {}
    );
  });

  describe('type', () => {
    it('should have CONDITION type', () => {
      expect(executor.type).toBe(NodeType.CONDITION);
    });
  });

  describe('execute - boolean conditions', () => {
    it('should evaluate true boolean condition', async () => {
      context.setVariable('isActive', true);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Active',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'isActive',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ condition: true, branch: 'true' });
      expect(result.nextNodeId).toBe('true-branch');
    });

    it('should evaluate false boolean condition', async () => {
      context.setVariable('isActive', false);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Active',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'isActive',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ condition: false, branch: 'false' });
      expect(result.nextNodeId).toBe('false-branch');
    });
  });

  describe('execute - comparison operators', () => {
    it('should evaluate equals condition', async () => {
      context.setVariable('status', 'active');

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Status',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'status == "active"',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate not equals condition', async () => {
      context.setVariable('count', 5);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Count',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'count != 0',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate greater than condition', async () => {
      context.setVariable('score', 85);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Score',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'score > 80',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate less than or equals condition', async () => {
      context.setVariable('age', 17);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Age',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'age <= 18',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });
  });

  describe('execute - logical operators', () => {
    it('should evaluate AND condition', async () => {
      context.setVariable('isLoggedIn', true);
      context.setVariable('isVerified', true);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Access',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'isLoggedIn && isVerified',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate OR condition', async () => {
      context.setVariable('isAdmin', false);
      context.setVariable('isModerator', true);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Permission',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'isAdmin || isModerator',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate NOT condition', async () => {
      context.setVariable('isBanned', false);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Ban Status',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: '!isBanned',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should evaluate complex logical expression', async () => {
      context.setVariable('age', 25);
      context.setVariable('isMember', true);
      context.setVariable('isBlocked', false);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Complex',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'age >= 18 && isMember && !isBlocked',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });
  });

  describe('execute - nested property access', () => {
    it('should access nested object properties', async () => {
      context.setVariable('user', { profile: { verified: true } });

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Verified',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'user.profile.verified',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });

    it('should access array length', async () => {
      context.setVariable('items', [1, 2, 3, 4, 5]);

      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Items',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'items.length > 0',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(true);
      expect(result.output?.condition).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle missing condition config', async () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Broken Condition',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {}
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_CONDITION');
    });

    it('should handle syntax errors in expression', async () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Invalid Expression',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'invalid syntax @#$',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = await executor.execute(node, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EVAL_ERROR');
    });
  });

  describe('validate', () => {
    it('should validate valid condition node', () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Status',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            expression: 'status == "active"',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(true);
    });

    it('should require condition config', () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Broken Condition',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {}
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition configuration is required');
    });

    it('should require expression', () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Broken Condition',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['true-branch', 'false-branch'],
        config: {
          condition: {
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition expression is required');
    });

    it('should require at least two dependents for branches', () => {
      const node: WorkflowNode = {
        nodeId: 'cond-1',
        name: 'Check Status',
        type: NodeType.CONDITION,
        dependencies: ['node-1'],
        dependents: ['only-one-branch'],
        config: {
          condition: {
            expression: 'status == "active"',
            trueBranch: 'true-branch',
            falseBranch: 'false-branch'
          }
        }
      };

      const result = executor.validate!(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Condition node should have at least 2 dependents for true/false branches');
    });
  });
});
