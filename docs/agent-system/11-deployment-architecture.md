# 增强型 Agent 系统 - 部署架构设计文档

**版本**: v1.0
**日期**: 2026-03-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 部署目标

- **高可用**: 99.9% 服务可用性
- **可扩展**: 支持水平扩展，应对流量增长
- **可观测**: 完整的监控、日志、告警体系
- **安全性**: 多层安全防护，数据加密

### 1.2 部署环境

| 环境 | 用途 | 规模 |
|------|------|------|
| 开发 (Dev) | 开发调试 | 单机 |
| 测试 (Test) | 功能/集成测试 | 2-4 节点 |
| 预发 (Staging) | 生产镜像验证 | 同生产 |
| 生产 (Prod) | 正式服务 | 多节点集群 |

---

## 2. 基础设施架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              流量入口层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DNS (Route 53 / Cloudflare)                                         │   │
│  │                    │                                                 │   │
│  │                    ▼                                                 │   │
│  │  CDN (CloudFront / Cloudflare)                                       │   │
│  │                    │                                                 │   │
│  │                    ▼                                                 │   │
│  │  WAF (Web Application Firewall)                                      │   │
│  │  - DDoS 防护                                                         │   │
│  │  - SQL 注入防护                                                      │   │
│  │  - XSS 防护                                                          │   │
│  │                    │                                                 │   │
│  │                    ▼                                                 │   │
│  │  Load Balancer (ALB / Nginx)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Kubernetes 集群                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Ingress Controller (Nginx)                      │   │
│  │  - SSL 终止                                                         │   │
│  │  - 路由分发                                                         │   │
│  │  - 限流控制                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Gateway (Kong)                           │   │
│  │  - 认证授权                                                         │   │
│  │  - 请求转换                                                         │   │
│  │  - 缓存                                                             │   │
│  │  - 日志                                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           Service Mesh                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Perception│  │  Gateway │  │ Workflow │  │ Business │            │   │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │            │   │
│  │  │ (3 pods) │  │ (3 pods) │  │ (3 pods) │  │ (3 pods) │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  │                                                                     │   │
│  │  HPA: CPU > 70% 或 内存 > 80% 时自动扩容                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Worker Nodes (BullMQ)                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   Agent      │  │   Workflow   │  │       Notification       │  │   │
│  │  │   Workers    │  │   Workers    │  │       Workers            │  │   │
│  │  │   (5 pods)   │  │   (5 pods)   │  │       (3 pods)           │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据层                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ MongoDB  │  │  Redis   │  │ Milvus   │  │   Kafka  │  │   MinIO  │      │
│  │ Primary  │  │ Cluster  │  │  Cluster │  │  Cluster │  │  (S3)    │      │
│  │ Replica  │  │          │  │          │  │          │  │          │      │
│  │   Set    │  │          │  │          │  │          │  │          │      │
│  │ (3 pods) │  │ (6 pods) │  │ (3 pods) │  │ (3 pods) │  │ (2 pods) │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 资源规划

#### 生产环境 (Production)

| 服务 | 实例数 | CPU/实例 | 内存/实例 | 存储 |
|------|--------|----------|-----------|------|
| API Gateway | 3 | 2核 | 4GB | 50GB |
| Perception Service | 3 | 4核 | 8GB | 100GB |
| Gateway Service | 3 | 4核 | 8GB | 100GB |
| Workflow Engine | 3 | 8核 | 16GB | 200GB |
| Business Service | 3 | 4核 | 8GB | 100GB |
| Agent Workers | 5 | 8核 | 16GB | 100GB |
| MongoDB | 3 | 4核 | 16GB | 500GB |
| Redis | 6 | 2核 | 8GB | 50GB |
| Milvus | 3 | 8核 | 32GB | 1TB |
| Kafka | 3 | 4核 | 16GB | 500GB |
| MinIO | 2 | 4核 | 8GB | 2TB |

#### 开发/测试环境

| 服务 | 实例数 | 资源配置 |
|------|--------|----------|
| All Services | 1 | 4核 8GB |
| MongoDB | 1 | 2核 4GB |
| Redis | 1 | 1核 2GB |
| Milvus | 1 | 2核 4GB |

---

## 3. Kubernetes 部署配置

### 3.1 Namespace 规划

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: agent-system\n  labels:
    app: agent-system
    environment: production

---
apiVersion: v1
kind: Namespace
metadata:
  name: agent-system-data
  labels:
    app: agent-system
    tier: data
```

### 3.2 Deployment 示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-engine
  namespace: agent-system
  labels:
    app: workflow-engine
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: workflow-engine
  template:
    metadata:
      labels:
        app: workflow-engine
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - workflow-engine
                topologyKey: kubernetes.io/hostname
      containers:
        - name: workflow-engine
          image: agent-system/workflow-engine:latest
          ports:
            - containerPort: 3000
              name: http
          resources:
            requests:
              cpu: "4"
              memory: "8Gi"
            limits:
              cpu: "8"
              memory: "16Gi"
          env:
            - name: NODE_ENV
              value: "production"
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: agent-system-secrets
                  key: mongodb-uri
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: agent-system-secrets
                  key: redis-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: config
              mountPath: /app/config
      volumes:
        - name: config
          configMap:
            name: workflow-engine-config
```

### 3.3 HPA 配置

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: workflow-engine-hpa
  namespace: agent-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: workflow-engine
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: workflow_queue_size
        target:
          type: AverageValue
          averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

### 3.4 Service 配置

```yaml
apiVersion: v1
kind: Service
metadata:
  name: workflow-engine
  namespace: agent-system
  labels:
    app: workflow-engine
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: workflow-engine

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-system-ingress
  namespace: agent-system
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - api.agent-system.com
      secretName: agent-system-tls
  rules:
    - host: api.agent-system.com
      http:
        paths:
          - path: /api/v1/workflows
            pathType: Prefix
            backend:
              service:
                name: workflow-engine
                port:
                  number: 80
          - path: /api/v1/agents
            pathType: Prefix
            backend:
              service:
                name: gateway-service
                port:
                  number: 80
```

---

## 4. 数据库部署

### 4.1 MongoDB (StatefulSet)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: agent-system-data
spec:
  serviceName: mongodb
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:7.0
          command:
            - mongod
            - --replSet
            - rs0
            - --bind_ip_all
          ports:
            - containerPort: 27017
          resources:
            requests:
              cpu: "4"
              memory: "16Gi"
            limits:
              cpu: "8"
              memory: "32Gi"
          volumeMounts:
            - name: data
              mountPath: /data/db
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 500Gi
        storageClassName: fast-ssd
```

### 4.2 Redis Cluster

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: agent-system-data
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
        - name: redis
          image: redis:7.0-alpine
          command:
            - redis-server
            - /etc/redis/redis.conf
          ports:
            - containerPort: 6379
            - containerPort: 16379
          resources:
            requests:
              cpu: "2"
              memory: "8Gi"
            limits:
              cpu: "4"
              memory: "16Gi"
          volumeMounts:
            - name: data
              mountPath: /data
            - name: config
              mountPath: /etc/redis
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 50Gi
```

---

## 5. 可观测性

### 5.1 监控架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            可观测性栈                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Metrics (Prometheus)        Logs (ELK/Loki)        Traces (Jaeger)        │
│  ┌─────────────────┐        ┌─────────────────┐    ┌─────────────────┐     │
│  │  Service Metrics │        │  Application    │    │  Request Traces │     │
│  │  - CPU/Memory   │        │    Logs         │    │  - Latency      │     │
│  │  - QPS/Latency  │        │  - Error Logs   │    │  - Dependencies │     │
│  │  - Error Rate   │        │  - Audit Logs   │    │  - Bottlenecks  │     │
│  └────────┬────────┘        └────────┬────────┘    └────────┬────────┘     │
│           │                          │                      │              │
│           └──────────────────────────┼──────────────────────┘              │
│                                      ▼                                     │
│                           ┌─────────────────┐                              │
│                           │    Grafana      │                              │
│                           │   Dashboards    │                              │
│                           └─────────────────┘                              │
│                                      │                                     │
│                                      ▼                                     │
│                           ┌─────────────────┐                              │
│                           │    AlertManager │                              │
│                           │  (PagerDuty/    │                              │
│                           │   Slack/Email)  │                              │
│                           └─────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 告警规则

```yaml
groups:
  - name: agent-system-alerts
    rules:
      # 服务可用性告警
      - alert: ServiceDown
        expr: up{job="agent-system"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"

      # 高延迟告警
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"

      # 错误率告警
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate is above 5%"

      # 队列积压告警
      - alert: QueueBacklog
        expr: bullmq_queue_waiting > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue {{ $labels.queue }} has high backlog"

      # 数据库连接告警
      - alert: DBConnectionHigh
        expr: mongodb_connections{state="current"} / mongodb_connections{state="available"} > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "MongoDB connections are high"
```

---

## 6. CI/CD 流程

### 6.1 部署流水线

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Code   │───▶│  Build  │───▶│  Test   │───▶│ Package │───▶│ Deploy  │
│  Commit │    │  & Lint │    │         │    │ & Push  │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  GitHub       Dockerfile    Unit Tests     Docker Hub    Kubernetes
  Actions      Build         Integration    Helm Chart    ArgoCD
                              E2E Tests                     GitOps
```

### 6.2 GitOps 配置 (ArgoCD)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agent-system
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/company/agent-system-gitops.git
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: agent-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## 7. 安全策略

### 7.1 网络安全

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             网络分层安全                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Internet ────────► WAF ────────► LB ────────► Ingress ───────► Service   │
│                      │              │              │               │        │
│                      │              │              │               │        │
│  DDoS 防护          HTTPS         限流/认证      mTLS           RBAC       │
│  SQL 注入           SSL           IP 白名单      证书管理        服务账号   │
│  XSS 防护                          负载均衡       路由控制                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 密钥管理

```yaml
# 使用 External Secrets Operator 集成 AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: agent-system-secrets
  namespace: agent-system
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: agent-system-secrets
    creationPolicy: Owner
  data:
    - secretKey: mongodb-uri
      remoteRef:
        key: prod/agent-system/mongodb
        property: uri
    - secretKey: redis-url
      remoteRef:
        key: prod/agent-system/redis
        property: url
```

---

## 8. 备份与恢复

### 8.1 备份策略

| 数据类型 | 备份频率 | 保留期 | 存储位置 |
|----------|----------|--------|----------|
| MongoDB | 每小时增量，每日全量 | 30天 | S3 |
| Redis | 每6小时 RDB | 7天 | S3 |
| 对象存储 | 跨区域复制 | 版本控制 | S3 Cross-Region |
| 配置文件 | 每次变更 | 无限 | Git |

### 8.2 恢复流程

```yaml
# MongoDB 恢复 Job
apiVersion: batch/v1
kind: Job
metadata:
  name: mongodb-restore
  namespace: agent-system-data
spec:
  template:
    spec:
      containers:
        - name: restore
          image: mongo:7.0
          command:
            - mongorestore
            - --uri=$(MONGODB_URI)
            - --archive=/backup/mongodb-backup.gz
          env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: mongodb-credentials
                  key: uri
          volumeMounts:
            - name: backup
              mountPath: /backup
      volumes:
        - name: backup
          persistentVolumeClaim:
            claimName: backup-pvc
      restartPolicy: OnFailure
```

---

## 9. 附录

### 9.1 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-03-10 | 初始版本 |

### 9.2 参考文档

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/)
- [MongoDB on Kubernetes](https://www.mongodb.com/docs/kubernetes-operator/stable/)
- [Redis Cluster Setup](https://redis.io/docs/management/scaling/)
