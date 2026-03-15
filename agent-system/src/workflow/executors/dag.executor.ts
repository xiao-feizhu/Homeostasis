import {
  WorkflowDefinition,
  WorkflowNode
} from '../entities/workflow-definition.entity';

export interface DAGExecutionResult {
  success: boolean;
  executionPath: string[];
  error?: {
    code: string;
    message: string;
    nodeId?: string;
  };
}

export interface DAGExecutionContext {
  executionId: string;
  workflowId: string;
  userId: string;
  variables: Record<string, any>;
}

/**
 * DAG 执行器
 * 负责拓扑排序和按依赖顺序执行节点
 */
export class DAGExecutor {
  /**
   * 执行 DAG 工作流
   * 按拓扑排序顺序执行所有节点
   */
  async execute(
    definition: WorkflowDefinition,
    context: DAGExecutionContext,
    nodeExecutor: (node: WorkflowNode, ctx: DAGExecutionContext) => Promise<any>
  ): Promise<DAGExecutionResult> {
    const executionPath: string[] = [];

    try {
      // 1. 拓扑排序
      const sortedNodes = this.topologicalSort(definition.nodes);

      if (!sortedNodes) {
        return {
          success: false,
          executionPath,
          error: {
            code: 'CIRCULAR_DEPENDENCY',
            message: 'Cannot execute workflow with circular dependencies'
          }
        };
      }

      // 2. 按顺序执行节点
      for (const node of sortedNodes) {
        // 检查节点是否可以执行（依赖是否已完成）
        if (!this.canExecute(node, executionPath)) {
          continue;
        }

        executionPath.push(node.nodeId);

        // 执行节点
        try {
          await nodeExecutor(node, context);
        } catch (error: any) {
          return {
            success: false,
            executionPath,
            error: {
              code: 'NODE_EXECUTION_FAILED',
              message: `Node ${node.nodeId} execution failed: ${error?.message || 'Unknown error'}`,
              nodeId: node.nodeId
            }
          };
        }
      }

      return {
        success: true,
        executionPath
      };
    } catch (error: any) {
      return {
        success: false,
        executionPath,
        error: {
          code: 'EXECUTION_ERROR',
          message: error?.message || 'Unknown error'
        }
      };
    }
  }

  /**
   * 拓扑排序 (Kahn's Algorithm)
   * 返回排序后的节点列表，如果存在循环则返回 null
   */
  topologicalSort(nodes: WorkflowNode[]): WorkflowNode[] | null {
    if (nodes.length === 0) {
      return [];
    }

    // 构建入度表和邻接表
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    const nodeMap = new Map<string, WorkflowNode>();

    // 初始化
    for (const node of nodes) {
      inDegree.set(node.nodeId, 0);
      adjacencyList.set(node.nodeId, []);
      nodeMap.set(node.nodeId, node);
    }

    // 计算入度（只考虑在工作流中定义的依赖）
    for (const node of nodes) {
      if (node.dependencies) {
        for (const depId of node.dependencies) {
          // 只处理在工作流中定义的依赖
          if (nodeMap.has(depId)) {
            const currentInDegree = inDegree.get(node.nodeId) || 0;
            inDegree.set(node.nodeId, currentInDegree + 1);

            // 添加邻接关系
            const neighbors = adjacencyList.get(depId) || [];
            neighbors.push(node.nodeId);
            adjacencyList.set(depId, neighbors);
          }
        }
      }
    }

    // 找到所有入度为 0 的节点
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: WorkflowNode[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);

      if (node) {
        sorted.push(node);
      }

      // 减少邻接节点的入度
      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighborId of neighbors) {
        const newInDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newInDegree);

        if (newInDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    // 如果排序后的节点数不等于原始节点数，说明存在循环
    if (sorted.length !== nodes.length) {
      return null;
    }

    return sorted;
  }

  /**
   * 检查节点是否可以执行
   * 所有依赖节点都已完成则可以执行
   */
  private canExecute(node: WorkflowNode, completedNodes: string[]): boolean {
    if (!node.dependencies || node.dependencies.length === 0) {
      return true;
    }

    return node.dependencies.every(depId => completedNodes.includes(depId));
  }

  /**
   * 获取可以并行执行的节点组
   * 返回数组的数组，每个内层数组包含可以并行执行的节点
   */
  getParallelExecutionGroups(nodes: WorkflowNode[]): WorkflowNode[][] {
    if (nodes.length === 0) {
      return [];
    }

    const groups: WorkflowNode[][] = [];
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    const nodeMap = new Map<string, WorkflowNode>();

    // 初始化
    for (const node of nodes) {
      inDegree.set(node.nodeId, 0);
      adjacencyList.set(node.nodeId, []);
      nodeMap.set(node.nodeId, node);
    }

    // 构建图
    for (const node of nodes) {
      if (node.dependencies) {
        for (const depId of node.dependencies) {
          const currentInDegree = inDegree.get(node.nodeId) || 0;
          inDegree.set(node.nodeId, currentInDegree + 1);

          const neighbors = adjacencyList.get(depId) || [];
          neighbors.push(node.nodeId);
          adjacencyList.set(depId, neighbors);
        }
      }
    }

    // 分层执行
    let currentGroup: WorkflowNode[] = [];
    let nextQueue: string[] = [];

    // 初始入度为 0 的节点
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        currentGroup.push(nodeMap.get(nodeId)!);
      }
    }

    while (currentGroup.length > 0) {
      groups.push(currentGroup);

      // 处理当前组的所有节点
      for (const node of currentGroup) {
        const neighbors = adjacencyList.get(node.nodeId) || [];
        for (const neighborId of neighbors) {
          const newInDegree = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, newInDegree);

          if (newInDegree === 0) {
            nextQueue.push(neighborId);
          }
        }
      }

      // 准备下一组
      currentGroup = nextQueue.map(id => nodeMap.get(id)!).filter(Boolean);
      nextQueue = [];
    }

    return groups;
  }

  /**
   * 查找从起始节点到目标节点的所有路径
   */
  findAllPaths(
    nodes: WorkflowNode[],
    startNodeId: string,
    endNodeId: string
  ): string[][] {
    const adjacencyList = this.buildAdjacencyList(nodes);
    const paths: string[][] = [];
    const currentPath: string[] = [startNodeId];
    const visited = new Set<string>();

    const dfs = (currentId: string) => {
      if (currentId === endNodeId) {
        paths.push([...currentPath]);
        return;
      }

      visited.add(currentId);
      const neighbors = adjacencyList.get(currentId) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          currentPath.push(neighbor);
          dfs(neighbor);
          currentPath.pop();
        }
      }

      visited.delete(currentId);
    };

    dfs(startNodeId);
    return paths;
  }

  /**
   * 获取节点的依赖深度
   */
  getNodeDepth(nodes: WorkflowNode[], targetNodeId: string): number {
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node);
    }

    const getDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) {
        return 0; // 循环依赖，返回 0
      }

      const node = nodeMap.get(nodeId);
      if (!node || !node.dependencies || node.dependencies.length === 0) {
        return 0;
      }

      visited.add(nodeId);
      const maxDependencyDepth = Math.max(
        ...node.dependencies.map(depId => getDepth(depId, new Set(visited)))
      );
      visited.delete(nodeId);

      return maxDependencyDepth + 1;
    };

    return getDepth(targetNodeId, new Set());
  }

  /**
   * 构建邻接表
   */
  private buildAdjacencyList(nodes: WorkflowNode[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    for (const node of nodes) {
      adjacencyList.set(node.nodeId, []);
    }

    for (const node of nodes) {
      if (node.dependencies) {
        for (const depId of node.dependencies) {
          const neighbors = adjacencyList.get(depId) || [];
          neighbors.push(node.nodeId);
          adjacencyList.set(depId, neighbors);
        }
      }
    }

    return adjacencyList;
  }
}
