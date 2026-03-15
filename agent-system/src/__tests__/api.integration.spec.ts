/**
 * API 集成测试
 *
 * 使用 supertest 测试 Express API 端点
 */

import request from 'supertest';
import express from 'express';
import { ApiApplication } from '../api/app';
import { NodeType, WorkflowStatus } from '../workflow/entities/workflow-definition.entity';

describe('API Integration Tests', () => {
  let app: express.Application;
  let apiApp: ApiApplication;

  beforeEach(() => {
    apiApp = new ApiApplication({ enableLogging: false });
    app = apiApp.app;
  });

  afterEach(async () => {
    await apiApp.stop();
  });

  describe('Root Endpoint', () => {
    it('GET / should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Agent System API');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.endpoints).toBeDefined();
    });
  });

  describe('Workflow API', () => {
    const createWorkflow = () => ({
      workflowId: `wf-${Date.now()}`,
      name: 'Test Workflow',
      version: '1.0.0',
      status: WorkflowStatus.ACTIVE,
      ownerId: 'user-001',
      schemaVersion: 1,
      nodes: [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['end'],
          config: {}
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {}
        }
      ]
    });

    describe('POST /api/workflows', () => {
      it('should create a new workflow', async () => {
        const workflow = createWorkflow();

        const response = await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.workflowId).toBe(workflow.workflowId);
      });

      it('should return error for invalid workflow', async () => {
        const invalidWorkflow = {
          workflowId: 'wf-invalid',
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/workflows')
          .send(invalidWorkflow)
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('should return 409 for duplicate workflow ID', async () => {
        const workflow = createWorkflow();

        // Create first
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        // Try to create again
        const response = await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('CONFLICT');
      });
    });

    describe('GET /api/workflows', () => {
      it('should return workflow list', async () => {
        // Create a workflow first
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const response = await request(app)
          .get('/api/workflows')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/workflows?page=1&limit=10')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/workflows?status=active')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/workflows/:id', () => {
      it('should return workflow by ID', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const response = await request(app)
          .get(`/api/workflows/${workflow.workflowId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.workflowId).toBe(workflow.workflowId);
      });

      it('should return 404 for non-existent workflow', async () => {
        const response = await request(app)
          .get('/api/workflows/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('NOT_FOUND');
      });
    });

    describe('PUT /api/workflows/:id', () => {
      it('should update existing workflow', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const update = {
          ...workflow,
          name: 'Updated Workflow'
        };

        const response = await request(app)
          .put(`/api/workflows/${workflow.workflowId}`)
          .send(update)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should return 404 for non-existent workflow', async () => {
        const response = await request(app)
          .put('/api/workflows/non-existent-id')
          .send(createWorkflow())
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/workflows/:id', () => {
      it('should delete workflow', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        await request(app)
          .delete(`/api/workflows/${workflow.workflowId}`)
          .expect(204);

        // Verify deletion
        const response = await request(app)
          .get(`/api/workflows/${workflow.workflowId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });

      it('should return 404 for non-existent workflow', async () => {
        const response = await request(app)
          .delete('/api/workflows/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/workflows/:id/validate', () => {
      it('should validate workflow', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const response = await request(app)
          .get(`/api/workflows/${workflow.workflowId}/validate`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.valid).toBeDefined();
      });

      it('should return 404 for non-existent workflow', async () => {
        const response = await request(app)
          .get('/api/workflows/non-existent-id/validate')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Execution API', () => {
    const createWorkflow = () => ({
      workflowId: `wf-exec-${Date.now()}`,
      name: 'Test Workflow',
      version: '1.0.0',
      status: WorkflowStatus.ACTIVE,
      ownerId: 'user-001',
      schemaVersion: 1,
      nodes: [
        {
          nodeId: 'start',
          name: 'Start',
          type: NodeType.START,
          dependencies: [],
          dependents: ['end'],
          config: {}
        },
        {
          nodeId: 'end',
          name: 'End',
          type: NodeType.END,
          dependencies: ['start'],
          dependents: [],
          config: {}
        }
      ]
    });

    describe('POST /api/executions', () => {
      it('should start new execution', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const response = await request(app)
          .post('/api/executions')
          .send({
            workflowId: workflow.workflowId,
            variables: { input: 'test' }
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.executionId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
      });

      it('should return 422 when workflowId is missing', async () => {
        const response = await request(app)
          .post('/api/executions')
          .send({ variables: {} })
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
      });

      it('should return 404 when workflow does not exist', async () => {
        const response = await request(app)
          .post('/api/executions')
          .send({
            workflowId: 'non-existent-wf',
            variables: {}
          })
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/executions', () => {
      it('should return execution list', async () => {
        const response = await request(app)
          .get('/api/executions')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should filter by workflowId', async () => {
        const response = await request(app)
          .get('/api/executions?workflowId=some-id')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/executions/:id', () => {
      it('should return execution details', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const execResponse = await request(app)
          .post('/api/executions')
          .send({
            workflowId: workflow.workflowId,
            variables: {}
          })
          .expect(201);

        const executionId = execResponse.body.data.executionId;

        const response = await request(app)
          .get(`/api/executions/${executionId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.executionId).toBe(executionId);
      });

      it('should return 404 for non-existent execution', async () => {
        const response = await request(app)
          .get('/api/executions/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/executions/:id/cancel', () => {
      it('should cancel pending execution', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const execResponse = await request(app)
          .post('/api/executions')
          .send({
            workflowId: workflow.workflowId,
            variables: {}
          })
          .expect(201);

        const executionId = execResponse.body.data.executionId;

        const response = await request(app)
          .post(`/api/executions/${executionId}/cancel`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
      });

      it('should return 404 for non-existent execution', async () => {
        const response = await request(app)
          .post('/api/executions/non-existent-id/cancel')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/executions/:id/snapshot', () => {
      it('should return execution snapshot', async () => {
        const workflow = createWorkflow();
        await request(app)
          .post('/api/workflows')
          .send(workflow)
          .expect(201);

        const execResponse = await request(app)
          .post('/api/executions')
          .send({
            workflowId: workflow.workflowId,
            variables: {}
          })
          .expect(201);

        const executionId = execResponse.body.data.executionId;

        const response = await request(app)
          .get(`/api/executions/${executionId}/snapshot`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should return 404 for non-existent execution', async () => {
        const response = await request(app)
          .get('/api/executions/non-existent-id/snapshot')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Breakpoint API', () => {
    describe('GET /api/breakpoints', () => {
      it('should return breakpoints list', async () => {
        const response = await request(app)
          .get('/api/breakpoints')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should filter by executionId', async () => {
        const response = await request(app)
          .get('/api/breakpoints?executionId=some-id')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/breakpoints/pending', () => {
      it('should return pending breakpoints', async () => {
        const response = await request(app)
          .get('/api/breakpoints/pending')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/breakpoints/:id', () => {
      it('should return 404 for non-existent breakpoint', async () => {
        const response = await request(app)
          .get('/api/breakpoints/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/breakpoints/:id/approve', () => {
      it('should return 422 when userId is missing', async () => {
        const response = await request(app)
          .post('/api/breakpoints/some-id/approve')
          .send({})
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
      });

      it('should handle non-existent breakpoint gracefully', async () => {
        // breakpoint.manager throws error for non-existent breakpoint
        // which results in 500 internal server error
        const response = await request(app)
          .post('/api/breakpoints/non-existent-id/approve')
          .send({ userId: 'user-001' })
          .expect(500);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/breakpoints/:id/reject', () => {
      it('should return 422 when userId is missing', async () => {
        const response = await request(app)
          .post('/api/breakpoints/some-id/reject')
          .send({})
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error?.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('POST /api/breakpoints/:id/cancel', () => {
      it('should return 404 for non-existent breakpoint', async () => {
        const response = await request(app)
          .post('/api/breakpoints/non-existent-id/cancel')
          .send({ userId: 'user-001' })
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/breakpoints/:id/events', () => {
      it('should return 404 for non-existent breakpoint', async () => {
        const response = await request(app)
          .get('/api/breakpoints/non-existent-id/events')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Metrics API', () => {
    describe('GET /api/metrics', () => {
      it('should return system metrics', async () => {
        const response = await request(app)
          .get('/api/metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/metrics/prometheus', () => {
      it('should return Prometheus format metrics', async () => {
        const response = await request(app)
          .get('/api/metrics/prometheus')
          .expect(200);

        expect(response.text).toBeDefined();
        expect(response.headers['content-type']).toContain('text/plain');
      });
    });

    describe('GET /api/health', () => {
      it('should return health status', async () => {
        const response = await request(app)
          .get('/api/health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('healthy');
        expect(response.body.data.timestamp).toBeDefined();
        expect(response.body.data.uptime).toBeDefined();
      });
    });

    describe('GET /api/health/ready', () => {
      it('should return ready status', async () => {
        const response = await request(app)
          .get('/api/health/ready')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ready');
      });
    });

    describe('GET /api/health/live', () => {
      it('should return alive status', async () => {
        const response = await request(app)
          .get('/api/health/live')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('alive');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
