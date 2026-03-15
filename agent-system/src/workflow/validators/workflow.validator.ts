import {
  WorkflowDefinition,
  WorkflowNode,
  NodeType,
  WorkflowStatus
} from '../entities/workflow-definition.entity';

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
}

export interface WorkflowValidationError {
  code: string;
  message: string;
  path: string;
  details?: Record<string, any>;
}

/**
 * 工作流验证器
 * 负责验证工作流定义的完整性和有效性
 */
export class WorkflowValidator {
  /**
   * 验证完整的工作流定义
   */
  validate(definition: WorkflowDefinition): WorkflowValidationResult {
    const errors: WorkflowValidationError[] = [];

    // 1. 基础字段验证
    errors.push(...this.validateBasicFields(definition));

    // 2. 节点验证
    errors.push(...this.validateNodes(definition.nodes));

    // 3. DAG 结构验证
    errors.push(...this.validateDAGStructure(definition));

    // 4. 循环依赖检测
    const cycleErrors = this.detectCycles(definition);
    errors.push(...cycleErrors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证基础字段
   */
  private validateBasicFields(definition: WorkflowDefinition): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    if (!definition.workflowId || definition.workflowId.trim() === '') {
      errors.push({
        code: 'MISSING_WORKFLOW_ID',
        message: 'Workflow ID is required',
        path: 'workflowId'
      });
    }

    if (!definition.name || definition.name.trim() === '') {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Workflow name is required',
        path: 'name'
      });
    }

    if (!definition.version || !this.isValidSemVer(definition.version)) {
      errors.push({
        code: 'INVALID_VERSION',
        message: 'Valid semantic version is required (e.g., 1.0.0)',
        path: 'version'
      });
    }

    if (!Object.values(WorkflowStatus).includes(definition.status)) {
      errors.push({
        code: 'INVALID_STATUS',
        message: `Invalid workflow status: ${definition.status}`,
        path: 'status'
      });
    }

    if (!definition.ownerId) {
      errors.push({
        code: 'MISSING_OWNER',
        message: 'Owner ID is required',
        path: 'ownerId'
      });
    }

    return errors;
  }

  /**
   * 验证节点列表
   */
  private validateNodes(nodes: WorkflowNode[]): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    if (!nodes || nodes.length === 0) {
      errors.push({
        code: 'NO_NODES',
        message: 'Workflow must have at least one node',
        path: 'nodes'
      });
      return errors;
    }

    // 检查节点ID唯一性
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      if (nodeIds.has(node.nodeId)) {
        errors.push({
          code: 'DUPLICATE_NODE_ID',
          message: `Duplicate node ID: ${node.nodeId}`,
          path: `nodes.${node.nodeId}`
        });
      }
      nodeIds.add(node.nodeId);

      // 验证单个节点
      errors.push(...this.validateSingleNode(node, nodes));
    }

    // 检查是否有起始节点
    const hasStartNode = nodes.some(n => n.type === NodeType.START);
    if (!hasStartNode) {
      errors.push({
        code: 'NO_START_NODE',
        message: 'Workflow must have a start node',
        path: 'nodes'
      });
    }

    // 检查是否有结束节点
    const hasEndNode = nodes.some(n => n.type === NodeType.END);
    if (!hasEndNode) {
      errors.push({
        code: 'NO_END_NODE',
        message: 'Workflow must have an end node',
        path: 'nodes'
      });
    }

    return errors;
  }

  /**
   * 验证单个节点
   */
  private validateSingleNode(
    node: WorkflowNode,
    allNodes: WorkflowNode[]
  ): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    if (!node.nodeId || node.nodeId.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'Node ID is required',
        path: 'node.nodeId'
      });
    }

    if (!node.name || node.name.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_NAME',
        message: `Node name is required for ${node.nodeId}`,
        path: `nodes.${node.nodeId}.name`
      });
    }

    if (!Object.values(NodeType).includes(node.type)) {
      errors.push({
        code: 'INVALID_NODE_TYPE',
        message: `Invalid node type: ${node.type}`,
        path: `nodes.${node.nodeId}.type`
      });
    }

    // 验证依赖节点是否存在
    if (node.dependencies) {
      for (const depId of node.dependencies) {
        const depExists = allNodes.some(n => n.nodeId === depId);
        if (!depExists) {
          errors.push({
            code: 'MISSING_DEPENDENCY',
            message: `Dependency node not found: ${depId}`,
            path: `nodes.${node.nodeId}.dependencies`
          });
        }
      }
    }

    // 验证超时时间
    if (node.timeout !== undefined && node.timeout <= 0) {
      errors.push({
        code: 'INVALID_TIMEOUT',
        message: 'Timeout must be a positive number',
        path: `nodes.${node.nodeId}.timeout`
      });
    }

    // 验证重试策略
    if (node.retryPolicy) {
      if (node.retryPolicy.maxRetries < 0) {
        errors.push({
          code: 'INVALID_RETRY_COUNT',
          message: 'Max retries must be non-negative',
          path: `nodes.${node.nodeId}.retryPolicy.maxRetries`
        });
      }
      if (node.retryPolicy.retryInterval < 0) {
        errors.push({
          code: 'INVALID_RETRY_INTERVAL',
          message: 'Retry interval must be non-negative',
          path: `nodes.${node.nodeId}.retryPolicy.retryInterval`
        });
      }
    }

    return errors;
  }

  /**
   * 验证 DAG 结构
   */
  private validateDAGStructure(definition: WorkflowDefinition): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];
    const { nodes } = definition;

    // 构建邻接表
    const adjacencyList = this.buildAdjacencyList(nodes);

    // 检查是否有孤立的节点（除了 start/end）
    for (const node of nodes) {
      if (node.type === NodeType.START || node.type === NodeType.END) {
        continue;
      }

      const hasIncoming = node.dependencies && node.dependencies.length > 0;
      const outgoingLength = adjacencyList.get(node.nodeId)?.length ?? 0;
      const hasOutgoing = outgoingLength > 0;

      if (!hasIncoming && !hasOutgoing) {
        errors.push({
          code: 'ISOLATED_NODE',
          message: `Node ${node.nodeId} is isolated (no connections)`,
          path: `nodes.${node.nodeId}`
        });
      }
    }

    return errors;
  }

  /**
   * 检测循环依赖
   * 使用 DFS 算法
   */
  detectCycles(definition: WorkflowDefinition): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];
    const { nodes } = definition;

    // 构建邻接表（从依赖关系到边的映射）
    const adjacencyList = this.buildAdjacencyList(nodes);

    // DFS 状态: 0=未访问, 1=访问中, 2=已完成
    const visitState = new Map<string, number>();
    const nodePath: string[] = [];

    for (const node of nodes) {
      visitState.set(node.nodeId, 0);
    }

    const dfs = (nodeId: string): boolean => {
      visitState.set(nodeId, 1); // 标记为访问中
      nodePath.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (visitState.get(neighbor) === 1) {
          // 发现回边，存在循环
          const cycleStart = nodePath.indexOf(neighbor);
          const cycle = [...nodePath.slice(cycleStart), neighbor];
          errors.push({
            code: 'CIRCULAR_DEPENDENCY',
            message: `Circular dependency detected: ${cycle.join(' -> ')}`,
            path: 'nodes',
            details: { cycle }
          });
          return true;
        }

        if (visitState.get(neighbor) === 0) {
          if (dfs(neighbor)) {
            return true;
          }
        }
      }

      nodePath.pop();
      visitState.set(nodeId, 2); // 标记为已完成
      return false;
    };

    for (const node of nodes) {
      if (visitState.get(node.nodeId) === 0) {
        dfs(node.nodeId);
      }
    }

    return errors;
  }

  /**
   * 构建邻接表
   */
  private buildAdjacencyList(nodes: WorkflowNode[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    // 初始化
    for (const node of nodes) {
      adjacencyList.set(node.nodeId, []);
    }

    // 从依赖关系构建边
    for (const node of nodes) {
      if (node.dependencies) {
        for (const depId of node.dependencies) {
          // 依赖关系: depId -> node.nodeId
          const neighbors = adjacencyList.get(depId) || [];
          neighbors.push(node.nodeId);
          adjacencyList.set(depId, neighbors);
        }
      }
    }

    return adjacencyList;
  }

  /**
   * 验证语义版本号
   */
  private isValidSemVer(version: string): boolean {
    const semVerRegex = /^\d+\.\d+\.\d+$/;
    return semVerRegex.test(version);
  }
}
