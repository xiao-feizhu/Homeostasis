import { WorkflowDefinition, ValidationResult } from '../types/workflow.types';

export interface IWorkflowValidator {
  validate(definition: WorkflowDefinition): ValidationResult;
  validateNodeCompleteness(definition: WorkflowDefinition): ValidationResult;
  validateNoCycles(definition: WorkflowDefinition): ValidationResult;
  validateInputOutputTypes(definition: WorkflowDefinition): ValidationResult;
}
