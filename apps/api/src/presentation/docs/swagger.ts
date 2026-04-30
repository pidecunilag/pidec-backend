export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'PIDEC API',
    version: '1.0.0',
    description: 'API Documentation for the Prototype Inter-Departmental Engineering Challenge (PIDEC).',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current API Version',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'Authentication is handled securely via HTTP-Only cookies. Once you log in via `/auth/login`, subsequent requests are automatically authenticated.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input' },
              details: { type: 'object' },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: { type: 'object' },
        },
      },
    },
  },
  security: [
    {
      cookieAuth: [],
    },
  ],
  tags: [
    { name: 'Public', description: 'Publicly accessible content' },
    { name: 'Auth', description: 'Authentication and user identity' },
    { name: 'Teams', description: 'Team management and invites' },
    { name: 'Submissions', description: 'Project submissions and verifications' },
    { name: 'Judge', description: 'Judging and evaluations' },
    { name: 'Admin', description: 'Administrative operations' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Public'],
        summary: 'Check API Health',
        responses: {
          200: { description: 'API is healthy' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Successful login (sets HTTP-Only cookie)' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new student',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  matricNumber: { type: 'string' },
                  department: { type: 'string' },
                  level: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Successful registration' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        responses: {
          200: { description: 'Tokens refreshed' },
        },
      },
    },
    '/teams': {
      get: {
        tags: ['Teams'],
        summary: 'Get current user team',
        responses: {
          200: { description: 'Team details retrieved' },
        },
      },
      post: {
        tags: ['Teams'],
        summary: 'Create a new team',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Team created' },
        },
      },
    },
    '/submissions': {
      post: {
        tags: ['Submissions'],
        summary: 'Submit project for current stage',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  stage: { type: 'number' },
                  videoLink: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Submission successful' },
        },
      },
    },
    '/judge/me': {
      get: {
        tags: ['Judge'],
        summary: 'Get judge profile',
        responses: {
          200: { description: 'Judge details retrieved' },
        },
      },
    },
    '/judge/submissions': {
      get: {
        tags: ['Judge'],
        summary: 'List submissions assigned to judge',
        parameters: [
          {
            name: 'stage',
            in: 'query',
            schema: { type: 'number' },
          },
        ],
        responses: {
          200: { description: 'Submissions retrieved' },
        },
      },
    },
    '/judge/stage-2/score': {
      post: {
        tags: ['Judge'],
        summary: 'Submit score for a stage 2 submission',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  submissionId: { type: 'string' },
                  innovation: { type: 'number' },
                  feasibility: { type: 'number' },
                  impact: { type: 'number' },
                  presentation: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Score submitted' },
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Get competition overview metrics',
        responses: {
          200: { description: 'Overview retrieved' },
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List all users',
        responses: {
          200: { description: 'Users retrieved' },
        },
      },
    },
    '/admin/teams': {
      get: {
        tags: ['Admin'],
        summary: 'List all teams',
        responses: {
          200: { description: 'Teams retrieved' },
        },
      },
    },
    '/admin/submissions': {
      get: {
        tags: ['Admin'],
        summary: 'List all submissions',
        responses: {
          200: { description: 'Submissions retrieved' },
        },
      },
    }
  },
};
