import { NotificationService, NotificationProvider } from '../hitl/notification.service';
import {
  NotificationTemplate,
  Breakpoint,
  BreakpointType,
  BreakpointStatus,
  BreakpointTriggerMode,
  ApprovalMode
} from '../entities/hitl.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockEmailSend: jest.Mock;
  let mockSmsSend: jest.Mock;
  let mockPushSend: jest.Mock;
  let mockEmailProvider: NotificationProvider;
  let mockSmsProvider: NotificationProvider;
  let mockPushProvider: NotificationProvider;

  beforeEach(() => {
    jest.useFakeTimers();
    mockEmailSend = jest.fn().mockResolvedValue({ success: true });
    mockSmsSend = jest.fn().mockResolvedValue({ success: true });
    mockPushSend = jest.fn().mockResolvedValue({ success: true });

    mockEmailProvider = { send: mockEmailSend };
    mockSmsProvider = { send: mockSmsSend };
    mockPushProvider = { send: mockPushSend };

    service = new NotificationService({
      email: mockEmailProvider,
      sms: mockSmsProvider,
      push: mockPushProvider
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createMockTemplate = (
    templateId: string = 'tpl-001',
    overrides: Partial<NotificationTemplate> = {}
  ): NotificationTemplate => ({
    templateId,
    name: 'Test Template',
    channels: ['email', 'sms'],
    content: {
      email: {
        title: '审批请求: {{workflowName}}',
        body: '您好 {{userName}}, 您有一个来自 {{workflowName}} 的审批请求。',
        actionUrl: '{{actionUrl}}',
        actionText: '立即处理'
      },
      sms: {
        title: '',
        body: '【系统】{{userName}}，您有{{workflowName}}的待审批任务，请尽快处理。'
      }
    },
    variables: [
      { name: 'userName', description: '用户名', source: 'context', path: 'user.name' },
      { name: 'workflowName', description: '工作流名称', source: 'context', path: 'workflow.name' },
      { name: 'actionUrl', description: '操作链接', source: 'context', path: 'url' }
    ],
    ...overrides
  });

  const createMockBreakpoint = (overrides: Partial<Breakpoint> = {}): Breakpoint => ({
    breakpointId: 'bp-001',
    executionId: 'exec-001',
    workflowId: 'wf-001',
    nodeId: 'node-1',
    type: BreakpointType.APPROVAL,
    mode: BreakpointTriggerMode.STATIC,
    status: BreakpointStatus.PENDING,
    config: {
      enabled: true,
      type: BreakpointType.APPROVAL,
      mode: BreakpointTriggerMode.STATIC,
      approvers: { users: ['user-1', 'user-2'] },
      approvalMode: ApprovalMode.ANY
    },
    context: {
      user: { name: '张三', id: 'user-1' },
      workflow: { name: '订单审批', id: 'wf-001' },
      url: 'https://example.com/approval/bp-001'
    },
    approvals: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  describe('registerTemplate', () => {
    it('should register a new template', () => {
      const template = createMockTemplate();
      const result = service.registerTemplate(template);

      expect(result.success).toBe(true);
      expect(service.getTemplate('tpl-001')).toEqual(template);
    });

    it('should reject duplicate template registration', () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = service.registerTemplate(template);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should validate template has at least one channel', () => {
      const template = createMockTemplate('tpl-002', { channels: [] });
      const result = service.registerTemplate(template);

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one channel');
    });

    it('should validate content for each channel', () => {
      const template = createMockTemplate('tpl-003', {
        channels: ['email', 'sms'],
        content: { email: { title: 'Test', body: 'Test' } } // missing sms
      });
      const result = service.registerTemplate(template);

      expect(result.success).toBe(false);
      expect(result.error).toContain('content for channel: sms');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with context variables', () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const breakpoint = createMockBreakpoint();
      const result = service.renderTemplate('tpl-001', 'email', breakpoint.context);

      expect(result.success).toBe(true);
      expect(result.content?.title).toBe('审批请求: 订单审批');
      expect(result.content?.body).toContain('张三');
      expect(result.content?.actionUrl).toBe('https://example.com/approval/bp-001');
    });

    it('should return error for non-existent template', () => {
      const result = service.renderTemplate('tpl-999', 'email', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for unsupported channel', () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = service.renderTemplate('tpl-001', 'push', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should handle missing variables gracefully', () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = service.renderTemplate('tpl-001', 'email', { user: {} });

      expect(result.success).toBe(true);
      expect(result.content?.body).toContain('{{userName}}'); // Keep placeholder if not found
    });

    it('should support nested variable paths', () => {
      const template = createMockTemplate('tpl-004', {
        variables: [{ name: 'deepValue', description: '深层值', source: 'context', path: 'level1.level2.value' }]
      });
      service.registerTemplate(template);

      const context = { level1: { level2: { value: 'found' } } };
      const result = service.renderTemplate('tpl-004', 'email', context);

      expect(result.success).toBe(true);
    });
  });

  describe('sendNotification', () => {
    it('should send notification via specified channel', async () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const breakpoint = createMockBreakpoint();
      const result = await service.sendNotification({
        templateId: 'tpl-001',
        channel: 'email',
        recipients: ['user@example.com'],
        context: breakpoint.context
      });

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
    });

    it('should send to multiple recipients', async () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = await service.sendNotification({
        templateId: 'tpl-001',
        channel: 'email',
        recipients: ['user1@example.com', 'user2@example.com'],
        context: {}
      });

      expect(result.success).toBe(true);
      expect(result.sent).toBe(2);
      expect(mockEmailSend).toHaveBeenCalledTimes(2);
    });

    it('should handle provider failure', async () => {
      mockEmailSend.mockRejectedValueOnce(new Error('SMTP error'));

      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = await service.sendNotification({
        templateId: 'tpl-001',
        channel: 'email',
        recipients: ['user@example.com'],
        context: {}
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors?.[0]).toContain('SMTP error');
    });

    it('should return error for unconfigured channel', async () => {
      const serviceWithoutSms = new NotificationService({
        email: mockEmailProvider
      });

      const template = createMockTemplate();
      serviceWithoutSms.registerTemplate(template);

      const result = await serviceWithoutSms.sendNotification({
        templateId: 'tpl-001',
        channel: 'sms',
        recipients: ['1234567890'],
        context: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('sendMultiChannel', () => {
    it('should send to multiple channels', async () => {
      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = await service.sendMultiChannel({
        templateId: 'tpl-001',
        channels: ['email', 'sms'],
        recipients: {
          email: ['user@example.com'],
          sms: ['1234567890']
        },
        context: {}
      });

      expect(result.success).toBe(true);
      expect(result.results.email?.sent).toBe(1);
      expect(result.results.sms?.sent).toBe(1);
    });

    it('should continue even if one channel fails', async () => {
      mockSmsSend.mockRejectedValueOnce(new Error('SMS error'));

      const template = createMockTemplate();
      service.registerTemplate(template);

      const result = await service.sendMultiChannel({
        templateId: 'tpl-001',
        channels: ['email', 'sms'],
        recipients: {
          email: ['user@example.com'],
          sms: ['1234567890']
        },
        context: {}
      });

      expect(result.success).toBe(true); // Partial success
      expect(result.results.email?.success).toBe(true);
      expect(result.results.sms?.success).toBe(false);
    });
  });

  describe('sendBreakpointNotification', () => {
    it('should send notification for breakpoint', async () => {
      const template = createMockTemplate('approval-request');
      service.registerTemplate(template);

      const breakpoint = createMockBreakpoint();
      const result = await service.sendBreakpointNotification(
        breakpoint,
        'approval-request',
        ['user@example.com']
      );

      expect(result.success).toBe(true);
      expect(mockEmailSend).toHaveBeenCalled();
    });

    it('should use breakpoint context for rendering', async () => {
      const template = createMockTemplate('approval-request');
      service.registerTemplate(template);

      const breakpoint = createMockBreakpoint({
        context: {
          user: { name: '李四' },
          workflow: { name: '报销审批' }
        }
      });

      await service.sendBreakpointNotification(
        breakpoint,
        'approval-request',
        ['user@example.com']
      );

      const callArg = mockEmailSend.mock.calls[0][0];
      expect(callArg.body).toContain('李四');
      expect(callArg.body).toContain('报销审批');
    });
  });

  describe('scheduleReminder', () => {
    it('should schedule reminder notification', () => {
      const breakpoint = createMockBreakpoint();
      const reminderTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes later

      const result = service.scheduleReminder({
        breakpointId: breakpoint.breakpointId,
        templateId: 'reminder',
        recipients: ['user@example.com'],
        scheduledAt: reminderTime
      });

      expect(result.success).toBe(true);
      expect(result.reminderId).toBeDefined();
    });

    it('should reject past reminder time', () => {
      const pastTime = new Date(Date.now() - 1000);

      const result = service.scheduleReminder({
        breakpointId: 'bp-001',
        templateId: 'reminder',
        recipients: ['user@example.com'],
        scheduledAt: pastTime
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('future');
    });
  });

  describe('getPendingReminders', () => {
    it('should return reminders that are due', () => {
      const breakpoint = createMockBreakpoint();
      // 使用未来时间创建提醒，然后 fast-forward
      const soonTime = new Date(Date.now() + 100);

      service.scheduleReminder({
        breakpointId: breakpoint.breakpointId,
        templateId: 'reminder',
        recipients: ['user@example.com'],
        scheduledAt: soonTime
      });

      // 等待时间过去
      jest.advanceTimersByTime(200);

      const dueReminders = service.getPendingReminders();
      expect(dueReminders.length).toBeGreaterThan(0);
    });

    it('should not return future reminders', () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);

      service.scheduleReminder({
        breakpointId: 'bp-001',
        templateId: 'reminder',
        recipients: ['user@example.com'],
        scheduledAt: futureTime
      });

      const dueReminders = service.getPendingReminders();
      expect(dueReminders.length).toBe(0);
    });
  });

  describe('cancelReminder', () => {
    it('should cancel scheduled reminder', () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const scheduleResult = service.scheduleReminder({
        breakpointId: 'bp-001',
        templateId: 'reminder',
        recipients: ['user@example.com'],
        scheduledAt: futureTime
      });

      const cancelResult = service.cancelReminder(scheduleResult.reminderId!);
      expect(cancelResult.success).toBe(true);

      const dueReminders = service.getPendingReminders();
      expect(dueReminders.length).toBe(0);
    });

    it('should return error for non-existent reminder', () => {
      const result = service.cancelReminder('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
