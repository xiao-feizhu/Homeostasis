import {
  ErrorClassifier,
  WorkflowError,
  ErrorCategory,
  ErrorSeverity,
  RetryableError,
  NonRetryableError,
  NetworkError,
  TimeoutError,
  ValidationError,
  ConfigurationError
} from '../errors/error.classifier';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('classify', () => {
    it('should classify network errors as retryable', () => {
      const error = new NetworkError('Connection refused');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe(ErrorSeverity.TRANSIENT);
    });

    it('should classify timeout errors as retryable', () => {
      const error = new TimeoutError('Request timeout');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TIMEOUT);
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe(ErrorSeverity.TRANSIENT);
    });

    it('should classify validation errors as non-retryable', () => {
      const error = new ValidationError('Invalid input');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.retryable).toBe(false);
      expect(result.severity).toBe(ErrorSeverity.CLIENT);
    });

    it('should classify configuration errors as non-retryable', () => {
      const error = new ConfigurationError('Missing API key');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.CONFIGURATION);
      expect(result.retryable).toBe(false);
      expect(result.severity).toBe(ErrorSeverity.FATAL);
    });

    it('should classify generic errors based on message patterns', () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
    });

    it('should classify rate limit errors as retryable with high severity', () => {
      const error = new Error('429 Too Many Requests');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should classify unknown errors as potentially retryable', () => {
      const error = new Error('Something unexpected happened');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.retryable).toBe(true); // Conservative approach
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('registerPattern', () => {
    it('should allow registering custom error patterns', () => {
      classifier.registerPattern(/CUSTOM_ERROR/, ErrorCategory.BUSINESS, false, ErrorSeverity.MEDIUM);

      const error = new Error('CUSTOM_ERROR: Business logic failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.BUSINESS);
      expect(result.retryable).toBe(false);
    });

    it('should prioritize later registered patterns', () => {
      classifier.registerPattern(/ERROR/, ErrorCategory.UNKNOWN, true);
      classifier.registerPattern(/BUSINESS_ERROR/, ErrorCategory.BUSINESS, false);

      const error = new Error('BUSINESS_ERROR: Logic failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.BUSINESS);
      expect(result.retryable).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = new RetryableError('Temporary failure');
      expect(classifier.isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new NonRetryableError('Permanent failure');
      expect(classifier.isRetryable(error)).toBe(false);
    });

    it('should work with plain Error objects', () => {
      expect(classifier.isRetryable(new Error('ECONNREFUSED'))).toBe(true);
      expect(classifier.isRetryable(new Error('Invalid config'))).toBe(false);
    });
  });

  describe('WorkflowError', () => {
    it('should create workflow error with code and message', () => {
      const error = new WorkflowError('TEST_CODE', 'Test message');

      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('WorkflowError');
    });

    it('should support error chaining', () => {
      const cause = new Error('Original error');
      const error = new WorkflowError('WRAPPED', 'Wrapped error', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('RetryableError', () => {
    it('should be marked as retryable', () => {
      const error = new RetryableError('Temporary issue');
      expect(error.retryable).toBe(true);
    });
  });

  describe('NonRetryableError', () => {
    it('should be marked as non-retryable', () => {
      const error = new NonRetryableError('Permanent issue');
      expect(error.retryable).toBe(false);
    });
  });
});
