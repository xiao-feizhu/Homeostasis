/**
 * Workflow 模块导出测试
 */

describe('Workflow Module Exports', () => {
  it('should export all entities and modules', () => {
    // 测试所有导出都能正常导入
    const exports = require('../index');

    // 验证核心导出存在
    expect(exports).toBeDefined();

    // Entities
    expect(exports.NodeType).toBeDefined();
    expect(exports.ExecutionStatus).toBeDefined();
    expect(exports.WorkflowStatus).toBeDefined();
    expect(exports.NodeExecutionStatus).toBeDefined();
    expect(exports.WorkflowEventType).toBeDefined();
    expect(exports.BreakpointType).toBeDefined();
    expect(exports.BreakpointTriggerMode).toBeDefined();
    expect(exports.BreakpointStatus).toBeDefined();
    expect(exports.ApprovalMode).toBeDefined();
    expect(exports.InterventionAction).toBeDefined();

    // Validators
    expect(exports.WorkflowValidator).toBeDefined();

    // Executors
    expect(exports.DAGExecutor).toBeDefined();
    expect(exports.NodeExecutorRegistry).toBeDefined();
    expect(exports.StartNodeExecutor).toBeDefined();
    expect(exports.EndNodeExecutor).toBeDefined();
    expect(exports.ConditionNodeExecutor).toBeDefined();
    expect(exports.CodeNodeExecutor).toBeDefined();
    expect(exports.LLMNodeExecutor).toBeDefined();
    expect(exports.APINodeExecutor).toBeDefined();
    expect(exports.HITLNodeExecutor).toBeDefined();
    expect(exports.LoopNodeExecutor).toBeDefined();
    expect(exports.ParallelNodeExecutor).toBeDefined();
    expect(exports.SubflowNodeExecutor).toBeDefined();
    expect(exports.NodeExecutionContextImpl).toBeDefined();

    // Error handling
    expect(exports.ErrorClassifier).toBeDefined();
    expect(exports.RetryExhaustedError).toBeDefined();
    expect(exports.FixedIntervalRetryPolicy).toBeDefined();
    expect(exports.ExponentialBackoffRetryPolicy).toBeDefined();
    expect(exports.LinearRetryPolicy).toBeDefined();
    expect(exports.CustomRetryPolicy).toBeDefined();
    expect(exports.RetryExecutor).toBeDefined();
    expect(exports.DeadLetterQueue).toBeDefined();
    expect(exports.CompensationManager).toBeDefined();
    expect(exports.SagaOrchestrator).toBeDefined();
    expect(exports.CompensationError).toBeDefined();
    expect(exports.WorkflowError).toBeDefined();
    expect(exports.RetryableError).toBeDefined();
    expect(exports.NonRetryableError).toBeDefined();
    expect(exports.NetworkError).toBeDefined();
    expect(exports.TimeoutError).toBeDefined();
    expect(exports.ValidationError).toBeDefined();
    expect(exports.ConfigurationError).toBeDefined();

    // Versioning
    expect(exports.VersionManager).toBeDefined();
    expect(exports.VersionComparator).toBeDefined();
    expect(exports.ChangeType).toBeDefined();
    expect(exports.MigrationEngine).toBeDefined();
    expect(exports.MigrationStrategy).toBeDefined();
    expect(exports.WorkflowSnapshot).toBeDefined();
    expect(exports.SnapshotStatus).toBeDefined();
    expect(exports.SemanticVersion).toBeDefined();
    expect(exports.VersionStatus).toBeDefined();

    // Stores
    expect(exports.StateManager).toBeDefined();

    // Repositories
    expect(exports.InMemoryWorkflowRepository).toBeDefined();
    expect(exports.InMemoryExecutionRepository).toBeDefined();
    expect(exports.InMemoryBreakpointRepository).toBeDefined();
    expect(exports.InMemoryCacheService).toBeDefined();
    expect(exports.InMemoryEventStore).toBeDefined();
    expect(exports.InMemorySnapshotStore).toBeDefined();
    expect(exports.CachedRepository).toBeDefined();

    // HITL
    expect(exports.BreakpointManager).toBeDefined();
    expect(exports.InterventionHandler).toBeDefined();
    expect(exports.ApprovalEngine).toBeDefined();
    expect(exports.NotificationService).toBeDefined();
    expect(exports.AuditLogger).toBeDefined();

    // Monitoring
    expect(exports.MetricsCollector).toBeDefined();
    expect(exports.MetricType).toBeDefined();
    expect(exports.PerformanceMonitor).toBeDefined();
    expect(exports.AlertManager).toBeDefined();
    expect(exports.AlertSeverity).toBeDefined();
    expect(exports.AlertCondition).toBeDefined();
    expect(exports.CacheOptimizer).toBeDefined();
  });
});
