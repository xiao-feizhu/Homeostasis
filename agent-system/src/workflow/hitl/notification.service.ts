import {
  NotificationTemplate,
  Breakpoint
} from '../entities/hitl.entity';

export interface NotificationProvider {
  send(message: {
    to: string;
    title?: string;
    body: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface RegisterTemplateResult {
  success: boolean;
  error?: string;
}

export interface RenderTemplateResult {
  success: boolean;
  content?: {
    title: string;
    body: string;
    actionUrl?: string;
    actionText?: string;
  };
  error?: string;
}

export interface SendNotificationResult {
  success: boolean;
  sent?: number;
  failed?: number;
  errors?: string[];
  error?: string;
}

export interface SendMultiChannelResult {
  success: boolean;
  results: {
    [channel: string]: {
      success: boolean;
      sent?: number;
      failed?: number;
      error?: string;
    };
  };
}

export interface ScheduleReminderResult {
  success: boolean;
  reminderId?: string;
  error?: string;
}

export interface CancelReminderResult {
  success: boolean;
  error?: string;
}

export interface Reminder {
  reminderId: string;
  breakpointId: string;
  templateId: string;
  recipients: string[];
  scheduledAt: Date;
  channel?: string;
}

export interface SendNotificationParams {
  templateId: string;
  channel: string;
  recipients: string[];
  context: Record<string, any>;
}

export interface SendMultiChannelParams {
  templateId: string;
  channels: string[];
  recipients: {
    [channel: string]: string[];
  };
  context: Record<string, any>;
}

export interface ScheduleReminderParams {
  breakpointId: string;
  templateId: string;
  recipients: string[];
  scheduledAt: Date;
  channel?: string;
}

export class NotificationService {
  private templates: Map<string, NotificationTemplate> = new Map();
  private providers: Map<string, NotificationProvider> = new Map();
  private reminders: Map<string, Reminder> = new Map();
  private reminderCounter = 0;

  constructor(providers: { [channel: string]: NotificationProvider }) {
    for (const [channel, provider] of Object.entries(providers)) {
      this.providers.set(channel, provider);
    }
  }

  /**
   * 注册通知模板
   */
  registerTemplate(template: NotificationTemplate): RegisterTemplateResult {
    // 检查重复
    if (this.templates.has(template.templateId)) {
      return {
        success: false,
        error: `Template ${template.templateId} already exists`
      };
    }

    // 验证至少有一个渠道
    if (!template.channels || template.channels.length === 0) {
      return {
        success: false,
        error: 'Template must have at least one channel'
      };
    }

    // 验证每个渠道都有对应的内容
    for (const channel of template.channels) {
      if (!template.content[channel]) {
        return {
          success: false,
          error: `Missing content for channel: ${channel}`
        };
      }
    }

    this.templates.set(template.templateId, template);
    return { success: true };
  }

  /**
   * 获取模板
   */
  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 渲染模板
   */
  renderTemplate(
    templateId: string,
    channel: string,
    context: Record<string, any>
  ): RenderTemplateResult {
    const template = this.templates.get(templateId);
    if (!template) {
      return { success: false, error: `Template ${templateId} not found` };
    }

    if (!template.channels.includes(channel)) {
      return {
        success: false,
        error: `Channel ${channel} not supported by template`
      };
    }

    const content = template.content[channel];
    if (!content) {
      return {
        success: false,
        error: `No content for channel ${channel}`
      };
    }

    // 渲染变量
    const renderVariable = (path: string, ctx: Record<string, any>): any => {
      const keys = path.split('.');
      let value: any = ctx;
      for (const key of keys) {
        if (value === null || value === undefined) {
          return undefined;
        }
        value = value[key];
      }
      return value;
    };

    let title = content.title;
    let body = content.body;
    let actionUrl = content.actionUrl;

    // 替换所有变量
    if (template.variables) {
      for (const variable of template.variables) {
        const value = renderVariable(variable.path, context);
        const placeholder = `{{${variable.name}}}`;
        const replacement = value !== undefined ? String(value) : placeholder;

        title = title?.replace(placeholder, replacement);
        body = body?.replace(placeholder, replacement);
        actionUrl = actionUrl?.replace(placeholder, replacement);
      }
    }

    return {
      success: true,
      content: {
        title: title || '',
        body,
        actionUrl,
        actionText: content.actionText
      }
    };
  }

  /**
   * 发送通知
   */
  async sendNotification(
    params: SendNotificationParams
  ): Promise<SendNotificationResult> {
    const { templateId, channel, recipients, context } = params;

    // 检查渠道是否配置
    const provider = this.providers.get(channel);
    if (!provider) {
      return {
        success: false,
        error: `Channel ${channel} not configured`
      };
    }

    // 渲染模板
    const renderResult = this.renderTemplate(templateId, channel, context);
    if (!renderResult.success) {
      return {
        success: false,
        error: renderResult.error
      };
    }

    const content = renderResult.content!;
    const errors: string[] = [];
    let sent = 0;
    let failed = 0;

    // 发送给所有接收者
    for (const recipient of recipients) {
      try {
        const result = await provider.send({
          to: recipient,
          title: content.title,
          body: content.body,
          actionUrl: content.actionUrl,
          actionText: content.actionText
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(result.error || `Failed to send to ${recipient}`);
        }
      } catch (error) {
        failed++;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      success: failed === 0 || sent > 0, // 部分成功也算成功
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 多渠道发送
   */
  async sendMultiChannel(
    params: SendMultiChannelParams
  ): Promise<SendMultiChannelResult> {
    const { templateId, channels, recipients, context } = params;
    const results: SendMultiChannelResult['results'] = {};

    for (const channel of channels) {
      const channelRecipients = recipients[channel] || [];
      const result = await this.sendNotification({
        templateId,
        channel,
        recipients: channelRecipients,
        context
      });

      results[channel] = {
        success: result.success && (result.failed || 0) === 0,
        sent: result.sent,
        failed: result.failed,
        error: result.error
      };
    }

    return {
      success: Object.values(results).some(r => r.success),
      results
    };
  }

  /**
   * 发送断点通知
   */
  async sendBreakpointNotification(
    breakpoint: Breakpoint,
    templateId: string,
    recipients: string[],
    channel: string = 'email'
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      templateId,
      channel,
      recipients,
      context: breakpoint.context
    });
  }

  /**
   * 安排提醒
   */
  scheduleReminder(params: ScheduleReminderParams): ScheduleReminderResult {
    const { breakpointId, templateId, recipients, scheduledAt, channel } = params;

    // 检查时间是否在未来
    if (scheduledAt.getTime() <= Date.now()) {
      return {
        success: false,
        error: 'Reminder time must be in the future'
      };
    }

    this.reminderCounter++;
    const reminderId = `reminder-${Date.now()}-${this.reminderCounter}`;

    const reminder: Reminder = {
      reminderId,
      breakpointId,
      templateId,
      recipients,
      scheduledAt,
      channel
    };

    this.reminders.set(reminderId, reminder);

    return {
      success: true,
      reminderId
    };
  }

  /**
   * 获取待执行的提醒
   */
  getPendingReminders(): Reminder[] {
    const now = new Date();
    const pending: Reminder[] = [];

    for (const reminder of this.reminders.values()) {
      if (reminder.scheduledAt <= now) {
        pending.push(reminder);
      }
    }

    return pending.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  /**
   * 取消提醒
   */
  cancelReminder(reminderId: string): CancelReminderResult {
    if (!this.reminders.has(reminderId)) {
      return {
        success: false,
        error: `Reminder ${reminderId} not found`
      };
    }

    this.reminders.delete(reminderId);
    return { success: true };
  }

  /**
   * 执行到期的提醒
   */
  async executeDueReminders(): Promise<void> {
    const dueReminders = this.getPendingReminders();

    for (const reminder of dueReminders) {
      const channel = reminder.channel || 'email';

      await this.sendNotification({
        templateId: reminder.templateId,
        channel,
        recipients: reminder.recipients,
        context: {} // 提醒通常不需要复杂的上下文
      });

      // 发送后删除
      this.reminders.delete(reminder.reminderId);
    }
  }
}
