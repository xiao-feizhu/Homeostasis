/**
 * 版本管理系统
 *
 * 支持语义化版本号和工作流版本生命周期管理
 */

export enum VersionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

export interface VersionMetadata {
  version: string;
  workflowId: string;
  definition: any;
  createdBy: string;
  createdAt: Date;
  status: VersionStatus;
  changeDescription?: string;
  publishedAt?: Date;
  deprecatedAt?: Date;
  deprecationReason?: string;
  archivedAt?: Date;
}

export interface CreateVersionOptions {
  workflowId: string;
  definition: any;
  createdBy: string;
  version?: string;
  bumpType?: 'major' | 'minor' | 'patch';
  changeDescription?: string;
}

/**
 * 语义化版本号
 */
export class SemanticVersion {
  constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
    public readonly prerelease?: string
  ) {}

  /**
   * 解析版本字符串
   */
  static parse(version: string): SemanticVersion {
    const regex = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;
    const match = version.match(regex);

    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    const [, major, minor, patch, prerelease] = match;
    return new SemanticVersion(
      parseInt(major, 10),
      parseInt(minor, 10),
      parseInt(patch, 10),
      prerelease
    );
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    let version = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) {
      version += `-${this.prerelease}`;
    }
    return version;
  }

  /**
   * 比较版本
   */
  compare(other: SemanticVersion): number {
    if (this.major !== other.major) {
      return this.major - other.major;
    }
    if (this.minor !== other.minor) {
      return this.minor - other.minor;
    }
    if (this.patch !== other.patch) {
      return this.patch - other.patch;
    }

    // 预发布版本号低于正式版本
    if (this.prerelease && !other.prerelease) {
      return -1;
    }
    if (!this.prerelease && other.prerelease) {
      return 1;
    }
    if (this.prerelease && other.prerelease) {
      return this.prerelease.localeCompare(other.prerelease);
    }

    return 0;
  }

  /**
   * 递增版本号
   */
  bump(type: 'major' | 'minor' | 'patch'): SemanticVersion {
    switch (type) {
      case 'major':
        return new SemanticVersion(this.major + 1, 0, 0);
      case 'minor':
        return new SemanticVersion(this.major, this.minor + 1, 0);
      case 'patch':
        return new SemanticVersion(this.major, this.minor, this.patch + 1);
      default:
        throw new Error(`Invalid bump type: ${type}`);
    }
  }
}

/**
 * 版本管理器
 */
export class VersionManager {
  private versions: Map<string, VersionMetadata[]> = new Map();

  /**
   * 创建新版本
   */
  async createVersion(options: CreateVersionOptions): Promise<VersionMetadata> {
    const { workflowId, definition, createdBy, version, bumpType, changeDescription } = options;

    // 确定版本号
    let newVersion: string;
    if (version) {
      // 检查版本是否已存在
      const existing = await this.getVersion(workflowId, version);
      if (existing) {
        throw new Error(`Version ${version} already exists for workflow ${workflowId}`);
      }
      newVersion = version;
    } else {
      // 自动递增版本
      newVersion = await this.generateNextVersion(workflowId, bumpType || 'patch');
    }

    const metadata: VersionMetadata = {
      version: newVersion,
      workflowId,
      definition,
      createdBy,
      createdAt: new Date(),
      status: VersionStatus.DRAFT,
      changeDescription,
    };

    // 存储版本
    if (!this.versions.has(workflowId)) {
      this.versions.set(workflowId, []);
    }
    this.versions.get(workflowId)!.push(metadata);

    return metadata;
  }

  /**
   * 发布版本
   */
  async publishVersion(workflowId: string, version: string): Promise<VersionMetadata> {
    const metadata = await this.getVersion(workflowId, version);
    if (!metadata) {
      throw new Error(`Version ${version} not found for workflow ${workflowId}`);
    }

    if (metadata.status !== VersionStatus.DRAFT) {
      throw new Error(`Version ${version} is not in draft status`);
    }

    metadata.status = VersionStatus.PUBLISHED;
    metadata.publishedAt = new Date();

    return metadata;
  }

  /**
   * 获取版本
   */
  async getVersion(workflowId: string, version: string): Promise<VersionMetadata | null> {
    const versions = this.versions.get(workflowId);
    if (!versions) {
      return null;
    }

    return versions.find(v => v.version === version) || null;
  }

  /**
   * 获取所有版本
   */
  async getVersions(
    workflowId: string,
    options: { status?: VersionStatus } = {}
  ): Promise<VersionMetadata[]> {
    const versions = this.versions.get(workflowId) || [];

    if (options.status) {
      return versions.filter(v => v.status === options.status);
    }

    return [...versions].sort((a, b) => {
      const va = SemanticVersion.parse(a.version);
      const vb = SemanticVersion.parse(b.version);
      return vb.compare(va); // 降序排列，最新版本在前
    });
  }

  /**
   * 获取最新已发布版本
   */
  async getLatestVersion(workflowId: string): Promise<VersionMetadata | null> {
    const versions = await this.getVersions(workflowId, { status: VersionStatus.PUBLISHED });
    if (versions.length === 0) {
      return null;
    }

    // 按版本号排序，返回最新的
    return versions.sort((a, b) => {
      const va = SemanticVersion.parse(a.version);
      const vb = SemanticVersion.parse(b.version);
      return vb.compare(va);
    })[0];
  }

  /**
   * 弃用版本
   */
  async deprecateVersion(
    workflowId: string,
    version: string,
    reason: string
  ): Promise<VersionMetadata> {
    const metadata = await this.getVersion(workflowId, version);
    if (!metadata) {
      throw new Error(`Version ${version} not found for workflow ${workflowId}`);
    }

    metadata.status = VersionStatus.DEPRECATED;
    metadata.deprecatedAt = new Date();
    metadata.deprecationReason = reason;

    return metadata;
  }

  /**
   * 归档版本
   */
  async archiveVersion(workflowId: string, version: string): Promise<VersionMetadata> {
    const metadata = await this.getVersion(workflowId, version);
    if (!metadata) {
      throw new Error(`Version ${version} not found for workflow ${workflowId}`);
    }

    metadata.status = VersionStatus.ARCHIVED;
    metadata.archivedAt = new Date();

    return metadata;
  }

  /**
   * 生成下一个版本号
   */
  private async generateNextVersion(
    workflowId: string,
    bumpType: 'major' | 'minor' | 'patch'
  ): Promise<string> {
    const latest = await this.getLatestVersion(workflowId);

    if (!latest) {
      return '1.0.0';
    }

    const currentVersion = SemanticVersion.parse(latest.version);
    const nextVersion = currentVersion.bump(bumpType);
    return nextVersion.toString();
  }
}
