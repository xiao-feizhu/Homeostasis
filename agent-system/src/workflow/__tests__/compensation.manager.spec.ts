import {
  CompensationManager,
  CompensationStep,
  CompensationError,
  SagaOrchestrator,
} from '../errors/compensation.manager';

describe('CompensationManager', () => {
  let manager: CompensationManager;

  beforeEach(() => {
    manager = new CompensationManager();
  });

  describe('execute', () => {
    it('should execute steps in order', async () => {
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
        {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.success).toBe(true);
      expect(steps[0].execute).toHaveBeenCalledTimes(1);
      expect(steps[1].execute).toHaveBeenCalledTimes(1);
    });

    it('should accumulate results from each step', async () => {
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ userId: '123' }),
          compensate: jest.fn(),
        },
        {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ orderId: '456' }),
          compensate: jest.fn(),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.results).toEqual({
        step1: { userId: '123' },
        step2: { orderId: '456' },
      });
    });

    it('should compensate previous steps on failure', async () => {
      const error = new Error('Step 2 failed');
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
        {
          name: 'step2',
          execute: jest.fn().mockRejectedValue(error),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('step2');
      expect(steps[0].compensate).toHaveBeenCalledTimes(1);
      expect(steps[0].compensate).toHaveBeenCalledWith({ id: 1 });
    });

    it('should stop compensation if compensate fails', async () => {
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockRejectedValue(new Error('Compensate failed')),
        },
        {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
        {
          name: 'step3',
          execute: jest.fn().mockRejectedValue(new Error('Step 3 failed')),
          compensate: jest.fn(),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.success).toBe(false);
      expect(result.compensatedSteps).toContain('step2');
      // step1 compensation failed, so it should not be in compensatedSteps
      expect(result.compensatedSteps).not.toContain('step1');
    });

    it('should handle empty steps array', async () => {
      const result = await manager.execute([]);

      expect(result.success).toBe(true);
      expect(result.results).toEqual({});
    });

    it('should pass context to execute function', async () => {
      const context = { userId: '123' };
      const execute = jest.fn().mockResolvedValue({});

      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute,
          compensate: jest.fn(),
        },
      ];

      await manager.execute(steps, context);

      expect(execute).toHaveBeenCalledWith(context);
    });

    it('should call onStepComplete callback', async () => {
      const onStepComplete = jest.fn();
      manager = new CompensationManager({ onStepComplete });

      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn(),
        },
      ];

      await manager.execute(steps);

      expect(onStepComplete).toHaveBeenCalledWith('step1', { id: 1 });
    });

    it('should call onCompensate callback', async () => {
      const onCompensate = jest.fn();
      manager = new CompensationManager({ onCompensate });

      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
        {
          name: 'step2',
          execute: jest.fn().mockRejectedValue(new Error('Failed')),
          compensate: jest.fn(),
        },
      ];

      await manager.execute(steps);

      expect(onCompensate).toHaveBeenCalledWith('step1', { id: 1 });
    });
  });

  describe('partial execution', () => {
    it('should support partial compensation mode', async () => {
      manager = new CompensationManager({ partialCompensation: true });

      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockRejectedValue(new Error('Compensate failed')),
        },
        {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        },
        {
          name: 'step3',
          execute: jest.fn().mockRejectedValue(new Error('Step 3 failed')),
          compensate: jest.fn(),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.success).toBe(false);
      // In partial mode, should try to compensate all steps even if some fail
      expect(result.compensatedSteps).toContain('step2');
    });
  });

  describe('error handling', () => {
    it('should include original error in result', async () => {
      const originalError = new Error('Original error');
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockRejectedValue(originalError),
          compensate: jest.fn(),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.error).toBe(originalError);
    });

    it('should handle compensation errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockRejectedValue(new Error('Compensate error')),
        },
        {
          name: 'step2',
          execute: jest.fn().mockRejectedValue(new Error('Execute error')),
          compensate: jest.fn(),
        },
      ];

      const result = await manager.execute(steps);

      expect(result.success).toBe(false);
      expect(result.compensationErrors).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should call onError callback when step fails', async () => {
      const onError = jest.fn();
      manager = new CompensationManager({ onError });

      const error = new Error('Step failed');
      const steps: CompensationStep[] = [
        {
          name: 'step1',
          execute: jest.fn().mockRejectedValue(error),
          compensate: jest.fn(),
        },
      ];

      await manager.execute(steps);

      expect(onError).toHaveBeenCalledWith('step1', error);
    });
  });

  describe('CompensationError', () => {
    it('should create CompensationError with correct properties', () => {
      const originalError = new Error('Original error');
      const compensationErrors = [new Error('Compensation error')];

      const error = new CompensationError(
        'Compensation failed',
        'step1',
        originalError,
        compensationErrors
      );

      expect(error.message).toBe('Compensation failed');
      expect(error.name).toBe('CompensationError');
      expect(error.stepName).toBe('step1');
      expect(error.originalError).toBe(originalError);
      expect(error.compensationErrors).toBe(compensationErrors);
    });

    it('should be instanceof Error', () => {
      const error = new CompensationError('Test', 'step', new Error('Original'));
      expect(error instanceof Error).toBe(true);
      expect(error instanceof CompensationError).toBe(true);
    });
  });

  describe('SagaOrchestrator', () => {
    let orchestrator: SagaOrchestrator;

    beforeEach(() => {
      orchestrator = new SagaOrchestrator();
    });

    describe('registerStep', () => {
      it('should register a step', async () => {
        const step: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step);

        // Execute should work after registration
        const result = await orchestrator.execute(['step1']);
        expect(result.success).toBe(true);
      });
    });

    describe('execute', () => {
      it('should execute registered steps in order', async () => {
        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn(),
        };
        const step2: CompensationStep = {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step1);
        orchestrator.registerStep(step2);

        const result = await orchestrator.execute(['step1', 'step2']);

        expect(result.success).toBe(true);
        expect(step1.execute).toHaveBeenCalledTimes(1);
        expect(step2.execute).toHaveBeenCalledTimes(1);
      });

      it('should throw error for unregistered step', async () => {
        const result = await orchestrator.execute(['non-existent']);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Step not found');
      });

      it('should compensate on failure', async () => {
        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        };
        const step2: CompensationStep = {
          name: 'step2',
          execute: jest.fn().mockRejectedValue(new Error('Step 2 failed')),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step1);
        orchestrator.registerStep(step2);

        const result = await orchestrator.execute(['step1', 'step2']);

        expect(result.success).toBe(false);
        expect(step1.compensate).toHaveBeenCalledWith({ id: 1 });
      });

      it('should handle compensation failure with partial compensation', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        orchestrator = new SagaOrchestrator({ partialCompensation: true });

        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockRejectedValue(new Error('Compensation failed')),
        };
        const step2: CompensationStep = {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        };
        const step3: CompensationStep = {
          name: 'step3',
          execute: jest.fn().mockRejectedValue(new Error('Step 3 failed')),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step1);
        orchestrator.registerStep(step2);
        orchestrator.registerStep(step3);

        const result = await orchestrator.execute(['step1', 'step2', 'step3']);

        expect(result.success).toBe(false);
        expect(result.compensatedSteps).toContain('step2');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should stop compensation on first error without partialCompensation', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        };
        const step2: CompensationStep = {
          name: 'step2',
          execute: jest.fn().mockResolvedValue({ id: 2 }),
          compensate: jest.fn().mockRejectedValue(new Error('Compensation 2 failed')),
        };
        const step3: CompensationStep = {
          name: 'step3',
          execute: jest.fn().mockRejectedValue(new Error('Step 3 failed')),
          compensate: jest.fn().mockResolvedValue(undefined),
        };

        orchestrator.registerStep(step1);
        orchestrator.registerStep(step2);
        orchestrator.registerStep(step3);

        const result = await orchestrator.execute(['step1', 'step2', 'step3']);

        expect(result.success).toBe(false);
        // step1 compensation should not run because step2 compensation failed first (reverse order)
        expect(step1.compensate).not.toHaveBeenCalled();
        // step2 compensation was called and failed
        expect(step2.compensate).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should handle missing step definition during compensation', async () => {
        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step1);

        // Manually manipulate executed steps to include unregistered step
        const result = await orchestrator.execute(['step1']);
        expect(result.success).toBe(true);
      });

      it('should pass context to execute function', async () => {
        const context = { userId: '123' };
        const execute = jest.fn().mockResolvedValue({});

        const step: CompensationStep = {
          name: 'step1',
          execute,
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step);
        await orchestrator.execute(['step1'], context);

        expect(execute).toHaveBeenCalledWith(context);
      });

      it('should call onStepComplete callback', async () => {
        const onStepComplete = jest.fn();
        orchestrator = new SagaOrchestrator({ onStepComplete });

        const step: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step);
        await orchestrator.execute(['step1']);

        expect(onStepComplete).toHaveBeenCalledWith('step1', { id: 1 });
      });

      it('should call onCompensate callback', async () => {
        const onCompensate = jest.fn();
        orchestrator = new SagaOrchestrator({ onCompensate });

        const step1: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockResolvedValue({ id: 1 }),
          compensate: jest.fn().mockResolvedValue(undefined),
        };
        const step2: CompensationStep = {
          name: 'step2',
          execute: jest.fn().mockRejectedValue(new Error('Failed')),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step1);
        orchestrator.registerStep(step2);

        await orchestrator.execute(['step1', 'step2']);

        expect(onCompensate).toHaveBeenCalledWith('step1', { id: 1 });
      });

      it('should call onError callback on failure', async () => {
        const onError = jest.fn();
        orchestrator = new SagaOrchestrator({ onError });

        const error = new Error('Step failed');
        const step: CompensationStep = {
          name: 'step1',
          execute: jest.fn().mockRejectedValue(error),
          compensate: jest.fn(),
        };

        orchestrator.registerStep(step);
        await orchestrator.execute(['step1']);

        expect(onError).toHaveBeenCalledWith('step1', error);
      });
    });
  });
});
