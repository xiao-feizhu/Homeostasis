/**
 * 版本比较系统
 *
 * 检测工作流定义之间的差异，分析兼容性
 */

import { WorkflowNode } from '../entities/workflow-definition.entity';

export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
}

export interface NodeChange {
  type: ChangeType;
  nodeId: string;
  nodeName?: string;
  details?: string;
  isBreaking?: boolean;
}

export interface WorkflowDiff {
  changes: NodeChange[];
  added: number;
  removed: number;
  modified: number;
  breakingChanges: number;
  isCompatible: boolean;
}

/**
 * 版本比较器
 */
export class VersionComparator {
  /**
   * 比较两个工作流版本
   */
  compare(oldNodes: WorkflowNode[], newNodes: WorkflowNode[]): WorkflowDiff {
    const changes: NodeChange[] = [];

    // 创建节点映射
    const oldNodeMap = new Map(oldNodes.map(n => [n.nodeId, n]));
    const newNodeMap = new Map(newNodes.map(n => [n.nodeId, n]));

    // 检测添加的节点
    for (const [nodeId, node] of newNodeMap) {
      if (!oldNodeMap.has(nodeId)) {
        changes.push({
          type: ChangeType.ADDED,
          nodeId,
          nodeName: node.name,
          isBreaking: false,
        });
      }
    }

    // 检测删除和修改的节点
    for (const [nodeId, oldNode] of oldNodeMap) {
      const newNode = newNodeMap.get(nodeId);

      if (!newNode) {
        // 节点被删除
        changes.push({
          type: ChangeType.REMOVED,
          nodeId,
          nodeName: oldNode.name,
          isBreaking: true,
        });
      } else {
        // 检查节点是否被修改
        const nodeChanges = this.compareNode(oldNode, newNode);
        if (nodeChanges.length > 0) {
          const isBreaking = this.isBreakingChange(oldNode, newNode, nodeChanges);
          changes.push({
            type: ChangeType.MODIFIED,
            nodeId,
            nodeName: oldNode.name,
            details: nodeChanges.join(', '),
            isBreaking,
          });
        }
      }
    }

    const added = changes.filter(c => c.type === ChangeType.ADDED).length;
    const removed = changes.filter(c => c.type === ChangeType.REMOVED).length;
    const modified = changes.filter(c => c.type === ChangeType.MODIFIED).length;
    const breakingChanges = changes.filter(c => c.isBreaking).length;

    return {
      changes,
      added,
      removed,
      modified,
      breakingChanges,
      isCompatible: breakingChanges === 0 && removed === 0,
    };
  }

  /**
   * 生成差异报告
   */
  generateReport(diff: WorkflowDiff): string {
    const lines: string[] = [];

    lines.push(`Workflow Changes Report`);
    lines.push(`======================`);
    lines.push(`Added: ${diff.added}`);
    lines.push(`Removed: ${diff.removed}`);
    lines.push(`Modified: ${diff.modified}`);
    lines.push(`Breaking Changes: ${diff.breakingChanges}`);
    lines.push(`Compatible: ${diff.isCompatible ? 'Yes' : 'No'}`);
    lines.push('');

    if (diff.changes.length > 0) {
      lines.push('Details:');
      lines.push('------');

      for (const change of diff.changes) {
        const breaking = change.isBreaking ? ' [BREAKING]' : '';
        lines.push(`${change.type.toUpperCase()}: ${change.nodeName || change.nodeId}${breaking}`);
        if (change.details) {
          lines.push(`  - ${change.details}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 检查兼容性
   */
  checkCompatibility(oldNodes: WorkflowNode[], newNodes: WorkflowNode[]): boolean {
    const diff = this.compare(oldNodes, newNodes);
    return diff.isCompatible;
  }

  /**
   * 比较单个节点
   */
  private compareNode(oldNode: WorkflowNode, newNode: WorkflowNode): string[] {
    const changes: string[] = [];

    // 比较节点类型
    if (oldNode.type !== newNode.type) {
      changes.push(`type changed from ${oldNode.type} to ${newNode.type}`);
    }

    // 比较名称
    if (oldNode.name !== newNode.name) {
      changes.push(`name changed from "${oldNode.name}" to "${newNode.name}"`);
    }

    // 比较依赖
    const oldDeps = new Set(oldNode.dependencies);
    const newDeps = new Set(newNode.dependencies);

    if (oldDeps.size !== newDeps.size || ![...oldDeps].every(d => newDeps.has(d))) {
      const added = [...newDeps].filter(d => !oldDeps.has(d));
      const removed = [...oldDeps].filter(d => !newDeps.has(d));

      if (added.length > 0) {
        changes.push(`dependencies added: ${added.join(', ')}`);
      }
      if (removed.length > 0) {
        changes.push(`dependencies removed: ${removed.join(', ')}`);
      }
    }

    // 比较配置
    const configChanges = this.compareConfig(oldNode.config, newNode.config);
    changes.push(...configChanges);

    return changes;
  }

  /**
   * 比较配置
   */
  private compareConfig(oldConfig: any, newConfig: any, path = ''): string[] {
    const changes: string[] = [];

    if (typeof oldConfig !== typeof newConfig) {
      changes.push(`${path}type changed`);
      return changes;
    }

    if (typeof oldConfig !== 'object' || oldConfig === null) {
      if (oldConfig !== newConfig) {
        changes.push(`${path}value changed`);
      }
      return changes;
    }

    const oldKeys = Object.keys(oldConfig);
    const newKeys = Object.keys(newConfig);

    // 检测删除的配置项
    for (const key of oldKeys) {
      if (!(key in newConfig)) {
        changes.push(`${path}${key} removed`);
      }
    }

    // 检测新增和修改的配置项
    for (const key of newKeys) {
      const newPath = path ? `${path}.${key}` : key;

      if (!(key in oldConfig)) {
        changes.push(`${newPath} added`);
      } else {
        const nestedChanges = this.compareConfig(
          oldConfig[key],
          newConfig[key],
          `${newPath}.`
        );
        changes.push(...nestedChanges);
      }
    }

    return changes;
  }

  /**
   * 判断是否为破坏性变更
   */
  private isBreakingChange(oldNode: WorkflowNode, newNode: WorkflowNode, changes: string[]): boolean {
    // 节点类型变更通常是破坏性的
    if (oldNode.type !== newNode.type) {
      return true;
    }

    // 依赖关系移除通常是破坏性的
    const oldDeps = new Set(oldNode.dependencies);
    const newDeps = new Set(newNode.dependencies);
    const removedDeps = [...oldDeps].filter(d => !newDeps.has(d));
    if (removedDeps.length > 0) {
      return true;
    }

    // 检查配置变更中的破坏性变更
    const breakingConfigChanges = ['endpoint', 'method', 'url', 'topic'];
    for (const change of changes) {
      const lowerChange = change.toLowerCase();
      for (const breaking of breakingConfigChanges) {
        if (lowerChange.includes(breaking) && lowerChange.includes('changed')) {
          return true;
        }
      }
    }

    return false;
  }
}
