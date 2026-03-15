import { IWorkflowValidator } from '../interfaces/workflow-validator.interface';
import {
  WorkflowDefinition,
  ValidationResult,
  ValidationError,
  WorkflowNodeType,
  DataSchema,
} from '../types/workflow.types';

export class WorkflowValidator implements IWorkflowValidator {
  validate(definition: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];

    if (!definition) {
      errors.push({
        field: 'definition',
        message: 'Workflow definition is null or undefined',
        code: 'NULL_DEFINITION',
      });
      return { valid: false, errors };
    }

    if (!definition.id || definition.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Workflow ID cannot be empty',
        code: 'EMPTY_WORKFLOW_ID',
      });
    }

    const completenessResult = this.validateNodeCompleteness(definition);
    errors.push(...completenessResult.errors);

    const cycleResult = this.validateNoCycles(definition);
    errors.push(...cycleResult.errors);

    const typeResult = this.validateInputOutputTypes(definition);
    errors.push(...typeResult.errors);

    const structureErrors = this.validateStructure(definition);
    errors.push(...structureErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateNodeCompleteness(definition: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];

    if (!definition || !definition.nodes) {
      return { valid: false, errors };
    }

    definition.nodes.forEach((node, index) => {
      if (!node.id || node.id.trim() === '') {
        errors.push({
          field: `nodes[${index}].id`,
          message: `Node at index ${index} has an empty ID`,
          code: 'EMPTY_NODE_ID',
        });
      }

      if (!node.name || node.name.trim() === '') {
        errors.push({
          field: `nodes[${index}].name`,
          message: `Node at index ${index} has an empty name`,
          code: 'EMPTY_NODE_NAME',
        });
      }

      if (node.dependencies === undefined) {
        errors.push({
          field: `nodes[${index}].dependencies`,
          message: `Node at index ${index} has undefined dependencies`,
          code: 'UNDEFINED_DEPENDENCIES',
        });
      } else if (!Array.isArray(node.dependencies)) {
        errors.push({
          field: `nodes[${index}].dependencies`,
          message: `Node at index ${index} has non-array dependencies`,
          code: 'INVALID_DEPENDENCIES_TYPE',
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateNoCycles(definition: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];

    if (!definition || !definition.edges) {
      return { valid: true, errors };
    }

    const nodeIds = new Set(definition.nodes.map((n) => n.id));
    const adjacencyList = new Map<string, string[]>();

    nodeIds.forEach((id) => adjacencyList.set(id, []));

    for (const edge of definition.edges) {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        adjacencyList.get(edge.from)!.push(edge.to);
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push({
            field: 'edges',
            message: 'Cycle detected in workflow graph',
            code: 'CYCLE_DETECTED',
          });
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateInputOutputTypes(definition: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];

    if (!definition) {
      return { valid: false, errors };
    }

    if (!definition.inputSchema) {
      errors.push({
        field: 'inputSchema',
        message: 'Workflow input schema is missing',
        code: 'MISSING_INPUT_SCHEMA',
      });
    } else {
      const schemaErrors = this.validateSchema(
        definition.inputSchema,
        'inputSchema',
      );
      errors.push(...schemaErrors);
    }

    if (!definition.outputSchema) {
      errors.push({
        field: 'outputSchema',
        message: 'Workflow output schema is missing',
        code: 'MISSING_OUTPUT_SCHEMA',
      });
    } else {
      const schemaErrors = this.validateSchema(
        definition.outputSchema,
        'outputSchema',
      );
      errors.push(...schemaErrors);
    }

    if (definition.nodes) {
      definition.nodes.forEach((node, index) => {
        if (node.inputSchema) {
          const nodeInputErrors = this.validateSchema(
            node.inputSchema,
            `nodes[${index}].inputSchema`,
          );
          errors.push(...nodeInputErrors);
        }

        if (node.outputSchema) {
          const nodeOutputErrors = this.validateSchema(
            node.outputSchema,
            `nodes[${index}].outputSchema`,
          );
          errors.push(...nodeOutputErrors);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateStructure(definition: WorkflowDefinition): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push({
        field: 'nodes',
        message: 'Workflow must have at least one node',
        code: 'EMPTY_NODES',
      });
      return errors;
    }

    const nodeIds = new Set<string>();
    const duplicates = new Set<string>();

    for (const node of definition.nodes) {
      if (nodeIds.has(node.id)) {
        duplicates.add(node.id);
      }
      nodeIds.add(node.id);
    }

    if (duplicates.size > 0) {
      errors.push({
        field: 'nodes',
        message: `Duplicate node IDs found: ${Array.from(duplicates).join(', ')}`,
        code: 'DUPLICATE_NODE_IDS',
      });
    }

    const startNodes = definition.nodes.filter(
      (n) => n.type === WorkflowNodeType.START,
    );

    if (startNodes.length === 0) {
      errors.push({
        field: 'nodes',
        message: 'Workflow must have exactly one start node',
        code: 'MISSING_START_NODE',
      });
    } else if (startNodes.length > 1) {
      errors.push({
        field: 'nodes',
        message: `Workflow has ${startNodes.length} start nodes, expected 1`,
        code: 'MULTIPLE_START_NODES',
      });
    }

    if (definition.edges) {
      for (const edge of definition.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          errors.push({
            field: 'edges',
            message: `Edge references non-existent node: ${edge.from} -> ${edge.to}`,
            code: 'INVALID_EDGE_REFERENCE',
          });
        }
      }
    }

    return errors;
  }

  private validateSchema(schema: DataSchema, field: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const validTypes = ['string', 'number', 'boolean', 'object', 'array', 'null'];

    if (!schema.type || !validTypes.includes(schema.type)) {
      errors.push({
        field: `${field}.type`,
        message: `Invalid schema type: ${schema.type}. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_SCHEMA_TYPE',
      });
    }

    return errors;
  }
}
