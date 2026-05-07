const jsonBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: {
    'application/json': {
      schema,
    },
  },
});

const multipartBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: {
    'multipart/form-data': {
      schema,
    },
  },
});

const successResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/SuccessResponse' },
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
});

const uuidPathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: {
    type: 'string',
    format: 'uuid',
  },
});

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'PIDEC API',
    version: '1.0.0',
    description: 'Backend API documentation for the PIDEC 1.0 platform.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current API version',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Optional bearer token support for API clients.',
      },
    },
    parameters: {
      CursorParam: {
        name: 'cursor',
        in: 'query',
        required: false,
        description: 'Cursor for pagination, typically an ISO datetime from the previous page.',
        schema: { type: 'string', format: 'date-time' },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Maximum number of items to return.',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      OffsetParam: {
        name: 'offset',
        in: 'query',
        required: false,
        description: 'Legacy offset pagination parameter still supported on admin list endpoints.',
        schema: { type: 'integer', minimum: 0 },
      },
      StageParam: {
        name: 'stage',
        in: 'query',
        required: false,
        description: 'Competition stage filter.',
        schema: { type: 'integer', minimum: 1, maximum: 3 },
      },
      QueryParam: {
        name: 'q',
        in: 'query',
        required: false,
        description: 'Free-text search query.',
        schema: { type: 'string', maxLength: 120 },
      },
      DepartmentParam: {
        name: 'department',
        in: 'query',
        required: false,
        description: 'Department filter.',
        schema: { type: 'string' },
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', additionalProperties: true },
          meta: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['success', 'data'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid request data' },
              details: { nullable: true },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password', 'matricNumber', 'department', 'level'],
        properties: {
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', format: 'password', example: 'password1' },
          matricNumber: { type: 'string', example: '210412345' },
          department: { type: 'string', example: 'Computer Engineering' },
          level: { type: 'integer', enum: [100, 200, 300, 400, 500] },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
      },
      VerifyEmailRequest: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', format: 'password' },
        },
      },
      RefreshSessionRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description:
              'Required for bearer-token clients. May also be sent in the x-refresh-token header or Authorization bearer header.',
          },
        },
      },
      LogoutRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description:
              'Optional but recommended for bearer-token clients so the backend can revoke the refresh session being logged out.',
          },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: { type: 'integer', enum: [100, 200, 300, 400, 500] },
        },
      },
      CreateTeamRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Team Innovators' },
        },
      },
      SendInviteRequest: {
        type: 'object',
        required: ['inviteeId'],
        properties: {
          inviteeId: { type: 'string', format: 'uuid' },
        },
      },
      RespondInviteRequest: {
        type: 'object',
        required: ['inviteId', 'status'],
        properties: {
          inviteId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['accepted', 'declined'] },
        },
      },
      RemoveMemberRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
      },
      Stage1SubmissionRequest: {
        type: 'object',
        required: ['token', 'formData'],
        properties: {
          token: { type: 'string', example: 'AbC123xYz890' },
          formData: {
            type: 'object',
            required: [
              'problem_statement',
              'proposed_solution',
              'theme_alignment',
              'feasibility',
              'departmental_relevance',
              'declarations',
            ],
            properties: {
              problem_statement: { type: 'string' },
              proposed_solution: { type: 'string' },
              theme_alignment: { type: 'string' },
              feasibility: { type: 'string' },
              departmental_relevance: { type: 'string' },
              declarations: {
                type: 'object',
                additionalProperties: { type: 'boolean', enum: [true] },
              },
            },
          },
        },
      },
      Stage2SubmissionRequest: {
        type: 'object',
        required: ['videoLink', 'formData'],
        properties: {
          videoLink: { type: 'string', format: 'uri' },
          formData: {
            type: 'object',
            required: [
              'design_summary',
              'engineering_decisions',
              'constraints_addressed',
              'testing_results',
            ],
            properties: {
              design_summary: { type: 'string' },
              engineering_decisions: { type: 'string' },
              constraints_addressed: { type: 'string' },
              testing_results: { type: 'string' },
            },
          },
          fileIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      Stage3SubmissionRequest: {
        type: 'object',
        required: ['formData', 'fileIds'],
        properties: {
          formData: {
            type: 'object',
            required: ['final_documentation_summary', 'team_ready'],
            properties: {
              final_documentation_summary: { type: 'string' },
              team_ready: { type: 'boolean', enum: [true] },
            },
          },
          fileIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
      },
      NotificationReadRequest: {
        type: 'object',
        additionalProperties: false,
      },
      VerificationUploadRequest: {
        type: 'object',
        required: ['document'],
        properties: {
          document: {
            type: 'string',
            format: 'binary',
            description: 'PDF or image verification document file upload.',
          },
          email: {
            type: 'string',
            format: 'email',
            description:
              'Required when the request is unauthenticated. Ignored when a valid bearer access token is present.',
          },
          matricNumber: {
            type: 'string',
            description:
              'Required when the request is unauthenticated. Must match the student account matric number.',
          },
        },
      },
      Stage1RepresentativeRequest: {
        type: 'object',
        required: ['submissionId'],
        properties: {
          submissionId: { type: 'string', format: 'uuid' },
          comments: { type: 'string' },
        },
      },
      Stage2ScoreRequest: {
        type: 'object',
        required: ['scores', 'comments'],
        properties: {
          scores: {
            type: 'object',
            additionalProperties: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
          },
          comments: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
          },
        },
      },
      SetActiveStageRequest: {
        type: 'object',
        required: ['stage'],
        properties: {
          stage: { type: 'integer', enum: [0, 1, 2, 3] },
        },
      },
      ToggleRequest: {
        type: 'object',
        required: ['open'],
        properties: {
          open: { type: 'boolean' },
        },
      },
      UpdateEditionRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          theme: { type: 'string' },
          announcementBanner: { type: 'string', nullable: true },
        },
      },
      VerificationDecisionRequest: {
        oneOf: [
          {
            type: 'object',
            required: ['decision'],
            properties: {
              decision: { type: 'string', enum: ['approve'] },
              note: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['decision', 'reason'],
            properties: {
              decision: { type: 'string', enum: ['reject'] },
              reason: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['decision'],
            properties: {
              decision: { type: 'string', enum: ['request_resubmission'] },
              note: { type: 'string' },
            },
          },
        ],
      },
      SuspendUserRequest: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string' },
        },
      },
      TeamActionRequest: {
        oneOf: [
          {
            type: 'object',
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['advance'] },
            },
          },
          {
            type: 'object',
            required: ['action', 'reason', 'atStage'],
            properties: {
              action: { type: 'string', enum: ['disqualify'] },
              reason: { type: 'string' },
              atStage: { type: 'integer', enum: [1, 2, 3] },
            },
          },
          {
            type: 'object',
            required: ['action'],
            properties: {
              action: { type: 'string', enum: ['unlock_submission'] },
            },
          },
        ],
      },
      GenerateTokenRequest: {
        type: 'object',
        required: ['department'],
        properties: {
          department: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateJudgeRequest: {
        type: 'object',
        required: ['name', 'email', 'stageScope', 'assignedDepartments'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          stageScope: { type: 'string', enum: ['stage_1', 'stage_2'] },
          assignedDepartments: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
      },
      EnterFeedbackRequest: {
        type: 'object',
        required: ['scores', 'comments', 'totalScore', 'outcome', 'evaluatorName'],
        properties: {
          scores: {
            type: 'object',
            additionalProperties: { type: 'number', minimum: 0, maximum: 100 },
          },
          comments: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          totalScore: { type: 'number', minimum: 0, maximum: 100 },
          outcome: { type: 'string', enum: ['advanced', 'not_advanced', 'pending'] },
          evaluatorName: { type: 'string' },
          evaluationDate: { type: 'string', format: 'date' },
        },
      },
      PublishFeedbackRequest: {
        type: 'object',
        required: ['submissionIds'],
        properties: {
          submissionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
          },
        },
      },
      CreateCheckpointRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time', nullable: true },
          sortOrder: { type: 'integer', minimum: 0 },
          isActive: { type: 'boolean' },
        },
      },
      UpdateCheckpointRequest: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time', nullable: true },
          sortOrder: { type: 'integer', minimum: 0 },
          isActive: { type: 'boolean' },
        },
      },
      LandingAssetRequest: {
        type: 'object',
        required: ['name', 'logoUrl'],
        properties: {
          name: { type: 'string' },
          logoUrl: { type: 'string', format: 'uri' },
          websiteUrl: { type: 'string', format: 'uri', nullable: true },
          sortOrder: { type: 'integer', minimum: 0 },
          isActive: { type: 'boolean' },
        },
      },
      LandingFaqRequest: {
        type: 'object',
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          sortOrder: { type: 'integer', minimum: 0 },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
  tags: [
    { name: 'Public', description: 'Publicly accessible endpoints' },
    { name: 'Auth', description: 'Authentication operations' },
    { name: 'Users', description: 'Authenticated user profile operations' },
    { name: 'Teams', description: 'Team management operations' },
    { name: 'Submissions', description: 'Submission operations' },
    { name: 'Notifications', description: 'Notification operations' },
    { name: 'Feedback', description: 'Feedback retrieval operations' },
    { name: 'Judge', description: 'Judge portal operations' },
    { name: 'Admin', description: 'Administrative operations' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Public'],
        summary: 'Health check',
        responses: {
          200: successResponse('API is healthy'),
        },
      },
    },
    '/public/landing-data': {
      get: {
        tags: ['Public'],
        summary: 'Get public landing-page data',
        security: [],
        responses: {
          200: successResponse('Landing data returned'),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new student account',
        description:
          'Creates the student account, sends the email verification message, and returns an authenticated bearer-token session immediately. The response includes user details plus accessToken and refreshToken.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: {
          201: successResponse('Registration completed'),
          400: errorResponse('Validation failed'),
          403: errorResponse('Registrations are closed'),
          409: errorResponse('Email already registered'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description:
          'Returns user details plus accessToken and refreshToken in the response body.',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: {
          200: successResponse('Login successful'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Invalid credentials'),
          429: errorResponse('Too many login attempts'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh session and issue fresh auth tokens',
        description:
          'Bearer-token clients should send refreshToken in the JSON body, x-refresh-token header, or Authorization bearer header. The response returns fresh accessToken and refreshToken.',
        requestBody: jsonBody({ $ref: '#/components/schemas/RefreshSessionRequest' }, false),
        responses: {
          200: successResponse('Session refreshed'),
          401: errorResponse('Refresh token is missing or invalid'),
          429: errorResponse('Too many refresh attempts'),
        },
      },
    },
    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email with token',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/VerifyEmailRequest' }),
        responses: {
          200: successResponse('Email verified'),
          400: errorResponse('Invalid or expired token'),
          429: errorResponse('Too many verification attempts'),
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset email',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/ForgotPasswordRequest' }),
        responses: {
          200: successResponse('Password reset request accepted'),
          429: errorResponse('Too many password reset requests'),
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/ResetPasswordRequest' }),
        responses: {
          200: successResponse('Password reset successful'),
          400: errorResponse('Invalid or expired token'),
          429: errorResponse('Too many password reset attempts'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out the current user',
        description:
          'Requires an authenticated access token. Clients should also provide refreshToken in the JSON body so the backend can revoke the corresponding refresh session.',
        requestBody: jsonBody({ $ref: '#/components/schemas/LogoutRequest' }, false),
        responses: {
          200: successResponse('Logout successful'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current authenticated session user',
        responses: {
          200: successResponse('Current user returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/auth/verification-document': {
      post: {
        tags: ['Auth'],
        summary: 'Upload a verification document',
        description:
          'Queues asynchronous AI verification. If the caller is already authenticated with a bearer access token, only the document field is required. If the caller is not authenticated, the multipart body must also include email and matricNumber.',
        requestBody: multipartBody({ $ref: '#/components/schemas/VerificationUploadRequest' }),
        responses: {
          202: successResponse('Verification document queued'),
          400: errorResponse('Invalid file'),
          401: errorResponse('Authentication required when identity fields are not provided'),
        },
      },
    },
    '/auth/reupload-doc': {
      post: {
        tags: ['Auth'],
        summary: 'Re-upload a verification document',
        description:
          'Queues another asynchronous verification attempt subject to cooldown and max-attempt rules. If the caller is not authenticated, include email and matricNumber in the multipart body.',
        requestBody: multipartBody({ $ref: '#/components/schemas/VerificationUploadRequest' }),
        responses: {
          202: successResponse('Verification document queued'),
          400: errorResponse('Invalid file'),
          401: errorResponse('Authentication required when identity fields are not provided'),
          429: errorResponse('Cooldown or upload limit reached'),
        },
      },
    },
    '/auth/verification-status': {
      get: {
        tags: ['Auth'],
        summary: 'Get current verification status',
        description:
          'Returns the verification workflow state for the authenticated session user. This is intended to be polled after registration and upload, so the client must send the access token on each request.',
        responses: {
          200: successResponse('Verification status returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get own profile',
        responses: {
          200: successResponse('Profile returned'),
          401: errorResponse('Authentication required'),
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update own profile',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateProfileRequest' }),
        responses: {
          200: successResponse('Profile updated'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/teams': {
      post: {
        tags: ['Teams'],
        summary: 'Create a team',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateTeamRequest' }),
        responses: {
          201: successResponse('Team created'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Forbidden by account or stage rules'),
        },
      },
      delete: {
        tags: ['Teams'],
        summary: 'Dissolve the current leader team',
        responses: {
          200: successResponse('Team dissolved'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Only a leader can dissolve a team'),
        },
      },
    },
    '/teams/me': {
      get: {
        tags: ['Teams'],
        summary: 'Get my team',
        responses: {
          200: successResponse('Team returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/teams/my': {
      get: {
        tags: ['Teams'],
        summary: 'Get my team (PRD alias)',
        responses: {
          200: successResponse('Team returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/teams/search': {
      get: {
        tags: ['Teams'],
        summary: 'Search eligible teammates',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 2, maxLength: 120 },
            description: 'Name search string.',
          },
        ],
        responses: {
          200: successResponse('Search results returned'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/teams/invites': {
      get: {
        tags: ['Teams'],
        summary: 'List my invites',
        responses: {
          200: successResponse('Invites returned'),
          401: errorResponse('Authentication required'),
        },
      },
      post: {
        tags: ['Teams'],
        summary: 'Send a team invite',
        requestBody: jsonBody({ $ref: '#/components/schemas/SendInviteRequest' }),
        responses: {
          201: successResponse('Invite sent'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Only leaders can invite'),
        },
      },
    },
    '/teams/invites/respond': {
      post: {
        tags: ['Teams'],
        summary: 'Respond to an invite',
        requestBody: jsonBody({ $ref: '#/components/schemas/RespondInviteRequest' }),
        responses: {
          200: successResponse('Invite response recorded'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/teams/invites/{id}/accept': {
      post: {
        tags: ['Teams'],
        summary: 'Accept a team invite',
        parameters: [uuidPathParam('id', 'Invite id')],
        responses: {
          200: successResponse('Invite accepted'),
          401: errorResponse('Authentication required'),
          404: errorResponse('Invite not found'),
        },
      },
    },
    '/teams/invites/{id}/decline': {
      post: {
        tags: ['Teams'],
        summary: 'Decline a team invite',
        parameters: [uuidPathParam('id', 'Invite id')],
        responses: {
          200: successResponse('Invite declined'),
          401: errorResponse('Authentication required'),
          404: errorResponse('Invite not found'),
        },
      },
    },
    '/teams/members/remove': {
      post: {
        tags: ['Teams'],
        summary: 'Remove a member using the legacy body-based endpoint',
        requestBody: jsonBody({ $ref: '#/components/schemas/RemoveMemberRequest' }),
        responses: {
          200: successResponse('Member removed'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Only leaders can remove members'),
        },
      },
    },
    '/teams/members/{userId}': {
      delete: {
        tags: ['Teams'],
        summary: 'Remove a member',
        parameters: [uuidPathParam('userId', 'User id to remove from the team')],
        responses: {
          200: successResponse('Member removed'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Only leaders can remove members'),
        },
      },
    },
    '/teams/{teamId}': {
      delete: {
        tags: ['Teams'],
        summary: 'Dissolve a team by id',
        parameters: [uuidPathParam('teamId', 'Team id')],
        responses: {
          200: successResponse('Team dissolved'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Only leaders can dissolve teams'),
        },
      },
    },
    '/submissions/me': {
      get: {
        tags: ['Submissions'],
        summary: 'List my team submissions',
        responses: {
          200: successResponse('Submissions returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/submissions/my': {
      get: {
        tags: ['Submissions'],
        summary: 'List my team submissions (PRD alias)',
        responses: {
          200: successResponse('Submissions returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/submissions': {
      post: {
        tags: ['Submissions'],
        summary: 'Submit for the active stage',
        requestBody: jsonBody({
          oneOf: [
            { $ref: '#/components/schemas/Stage1SubmissionRequest' },
            { $ref: '#/components/schemas/Stage2SubmissionRequest' },
            { $ref: '#/components/schemas/Stage3SubmissionRequest' },
          ],
        }),
        responses: {
          201: successResponse('Submission created'),
          200: successResponse('Duplicate submission returned'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Submission not allowed'),
        },
      },
    },
    '/submissions/stage-1': {
      post: {
        tags: ['Submissions'],
        summary: 'Submit a Stage 1 entry',
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage1SubmissionRequest' }),
        responses: {
          201: successResponse('Stage 1 submission created'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/submissions/stage-2': {
      post: {
        tags: ['Submissions'],
        summary: 'Submit a Stage 2 entry',
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage2SubmissionRequest' }),
        responses: {
          201: successResponse('Stage 2 submission created'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/submissions/stage-3': {
      post: {
        tags: ['Submissions'],
        summary: 'Submit a Stage 3 entry',
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage3SubmissionRequest' }),
        responses: {
          201: successResponse('Stage 3 submission created'),
          400: errorResponse('Validation failed'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/submissions/{id}/feedback': {
      get: {
        tags: ['Submissions'],
        summary: 'Get feedback for a submission',
        parameters: [uuidPathParam('id', 'Submission id')],
        responses: {
          200: successResponse('Feedback returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          200: successResponse('Notifications returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/notifications/{id}/read': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        parameters: [uuidPathParam('id', 'Notification id')],
        responses: {
          200: successResponse('Notification marked as read'),
          401: errorResponse('Authentication required'),
        },
      },
      patch: {
        tags: ['Notifications'],
        summary: 'Mark a notification as read',
        parameters: [uuidPathParam('id', 'Notification id')],
        responses: {
          200: successResponse('Notification marked as read'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        responses: {
          200: successResponse('Notifications marked as read'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/feedback/me': {
      get: {
        tags: ['Feedback'],
        summary: 'List published feedback for my team',
        responses: {
          200: successResponse('Feedback returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/feedback/{submissionId}': {
      get: {
        tags: ['Feedback'],
        summary: 'Get published feedback for a submission',
        parameters: [uuidPathParam('submissionId', 'Submission id')],
        responses: {
          200: successResponse('Feedback returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/judge/me': {
      get: {
        tags: ['Judge'],
        summary: 'Get judge profile',
        responses: {
          200: successResponse('Judge profile returned'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/judge/submissions': {
      get: {
        tags: ['Judge'],
        summary: 'List submissions visible to the judge for the judge-scoped stage only',
        parameters: [{ $ref: '#/components/parameters/StageParam' }],
        responses: {
          200: successResponse('Judge submissions returned'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Requested stage is outside judge scope'),
        },
      },
    },
    '/judge/stage-1/representative': {
      post: {
        tags: ['Judge'],
        summary: 'Pick a Stage 1 representative',
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage1RepresentativeRequest' }),
        responses: {
          200: successResponse('Representative selection saved'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/judge/stage-2/score': {
      post: {
        tags: ['Judge'],
        summary: 'Submit a Stage 2 score with submission id in the body',
        requestBody: jsonBody({
          allOf: [
            { $ref: '#/components/schemas/Stage2ScoreRequest' },
            {
              type: 'object',
              required: ['submissionId'],
              properties: {
                submissionId: { type: 'string', format: 'uuid' },
              },
            },
          ],
        }),
        responses: {
          200: successResponse('Score saved'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/judge/scores/{submissionId}': {
      post: {
        tags: ['Judge'],
        summary: 'Submit a Stage 2 score using a path parameter',
        parameters: [uuidPathParam('submissionId', 'Submission id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage2ScoreRequest' }),
        responses: {
          200: successResponse('Score saved'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/judge/selections/{deptId}': {
      post: {
        tags: ['Judge'],
        summary: 'Pick a representative for a department',
        parameters: [
          {
            name: 'deptId',
            in: 'path',
            required: true,
            description: 'Department identifier or slug used by the caller.',
            schema: { type: 'string' },
          },
        ],
        requestBody: jsonBody({ $ref: '#/components/schemas/Stage1RepresentativeRequest' }),
        responses: {
          200: successResponse('Representative selection saved'),
          401: errorResponse('Authentication required'),
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin overview metrics',
        responses: {
          200: successResponse('Overview returned'),
          401: errorResponse('Authentication required'),
          403: errorResponse('Admin access required'),
        },
      },
    },
    '/admin/verifications/flagged': {
      get: {
        tags: ['Admin'],
        summary: 'List flagged verification items',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
        ],
        responses: {
          200: successResponse('Flagged verifications returned'),
        },
      },
    },
    '/admin/verifications/{userId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Apply a verification decision',
        parameters: [uuidPathParam('userId', 'User id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/VerificationDecisionRequest' }),
        responses: {
          200: successResponse('Verification decision applied'),
          400: errorResponse('Validation failed'),
        },
      },
    },
    '/admin/students': {
      get: {
        tags: ['Admin'],
        summary: 'List students',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          {
            name: 'verificationStatus',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'hasTeam',
            in: 'query',
            schema: { type: 'boolean' },
          },
          {
            name: 'isSuspended',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: successResponse('Students returned'),
        },
      },
    },
    '/admin/students/{userId}/suspend': {
      patch: {
        tags: ['Admin'],
        summary: 'Suspend a student',
        parameters: [uuidPathParam('userId', 'User id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/SuspendUserRequest' }),
        responses: {
          200: successResponse('Student suspended'),
        },
      },
    },
    '/admin/teams': {
      get: {
        tags: ['Admin'],
        summary: 'List teams',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'disqualified', 'under_review'] },
          },
          {
            name: 'currentStage',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 3 },
          },
        ],
        responses: {
          200: successResponse('Teams returned'),
        },
      },
    },
    '/admin/teams/{teamId}/stage': {
      patch: {
        tags: ['Admin'],
        summary: 'Apply a team stage action',
        parameters: [uuidPathParam('teamId', 'Team id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/TeamActionRequest' }),
        responses: {
          200: successResponse('Team action applied'),
        },
      },
    },
    '/admin/submissions': {
      get: {
        tags: ['Admin'],
        summary: 'List submissions',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          { $ref: '#/components/parameters/StageParam' },
          {
            name: 'teamId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['submitted', 'under_review', 'feedback_published'] },
          },
        ],
        responses: {
          200: successResponse('Submissions returned'),
        },
      },
    },
    '/admin/tokens': {
      get: {
        tags: ['Admin'],
        summary: 'List department tokens',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          {
            name: 'includeRetired',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: successResponse('Tokens returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Generate a department token',
        requestBody: jsonBody({ $ref: '#/components/schemas/GenerateTokenRequest' }),
        responses: {
          200: successResponse('Token generated'),
        },
      },
    },
    '/admin/feedback/{submissionId}': {
      post: {
        tags: ['Admin'],
        summary: 'Enter feedback for a submission',
        parameters: [uuidPathParam('submissionId', 'Submission id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/EnterFeedbackRequest' }),
        responses: {
          200: successResponse('Feedback saved'),
        },
      },
    },
    '/admin/feedback/{submissionId}/publish': {
      patch: {
        tags: ['Admin'],
        summary: 'Publish feedback for a submission',
        parameters: [uuidPathParam('submissionId', 'Submission id')],
        responses: {
          200: successResponse('Feedback published'),
        },
      },
    },
    '/admin/settings/edition': {
      patch: {
        tags: ['Admin'],
        summary: 'Update active edition settings',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateEditionRequest' }),
        responses: {
          200: successResponse('Edition updated'),
        },
      },
    },
    '/admin/edition': {
      patch: {
        tags: ['Admin'],
        summary: 'Update active edition settings (legacy route)',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateEditionRequest' }),
        responses: {
          200: successResponse('Edition updated'),
        },
      },
    },
    '/admin/stage': {
      post: {
        tags: ['Admin'],
        summary: 'Set the active stage',
        requestBody: jsonBody({ $ref: '#/components/schemas/SetActiveStageRequest' }),
        responses: {
          200: successResponse('Stage updated'),
        },
      },
    },
    '/admin/signup': {
      post: {
        tags: ['Admin'],
        summary: 'Open or close student registration',
        requestBody: jsonBody({ $ref: '#/components/schemas/ToggleRequest' }),
        responses: {
          200: successResponse('Signup state updated'),
        },
      },
    },
    '/admin/submission-window': {
      post: {
        tags: ['Admin'],
        summary: 'Open or close the submission window',
        requestBody: jsonBody({ $ref: '#/components/schemas/ToggleRequest' }),
        responses: {
          200: successResponse('Submission window updated'),
        },
      },
    },
    '/admin/team-lock': {
      post: {
        tags: ['Admin'],
        summary: 'Toggle team management lock',
        requestBody: jsonBody({ $ref: '#/components/schemas/ToggleRequest' }),
        responses: {
          200: successResponse('Team lock updated'),
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['student', 'admin', 'judge'] },
          },
          {
            name: 'verificationStatus',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'hasTeam',
            in: 'query',
            schema: { type: 'boolean' },
          },
          {
            name: 'isSuspended',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: successResponse('Users returned'),
        },
      },
    },
    '/admin/verification-queue': {
      get: {
        tags: ['Admin'],
        summary: 'List pending or flagged verification items',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          { $ref: '#/components/parameters/QueryParam' },
          { $ref: '#/components/parameters/DepartmentParam' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'flagged'] },
          },
        ],
        responses: {
          200: successResponse('Verification queue returned'),
        },
      },
    },
    '/admin/checkpoints': {
      get: {
        tags: ['Admin'],
        summary: 'List Stage 2 checkpoints',
        parameters: [
          {
            name: 'includeDeleted',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: successResponse('Checkpoints returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a Stage 2 checkpoint',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateCheckpointRequest' }),
        responses: {
          201: successResponse('Checkpoint created'),
        },
      },
    },
    '/admin/checkpoints/{checkpointId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a Stage 2 checkpoint',
        parameters: [uuidPathParam('checkpointId', 'Checkpoint id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateCheckpointRequest' }),
        responses: {
          200: successResponse('Checkpoint updated'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a Stage 2 checkpoint',
        parameters: [uuidPathParam('checkpointId', 'Checkpoint id')],
        responses: {
          200: successResponse('Checkpoint deleted'),
        },
      },
    },
    '/admin/judges': {
      get: {
        tags: ['Admin'],
        summary: 'List judges',
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/OffsetParam' },
          {
            name: 'stageScope',
            in: 'query',
            schema: { type: 'string', enum: ['stage_1', 'stage_2'] },
          },
          {
            name: 'isActive',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: successResponse('Judges returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a new platform-managed judge account and send onboarding email',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateJudgeRequest' }),
        responses: {
          201: successResponse('Judge created'),
          409: errorResponse('A user account already exists for this email'),
        },
      },
    },
    '/admin/judges/{judgeId}/deactivate': {
      post: {
        tags: ['Admin'],
        summary: 'Deactivate a judge',
        parameters: [uuidPathParam('judgeId', 'Judge id')],
        responses: {
          200: successResponse('Judge deactivated'),
        },
      },
    },
    '/admin/users/{userId}/verification': {
      post: {
        tags: ['Admin'],
        summary: 'Apply a verification decision (legacy route)',
        parameters: [uuidPathParam('userId', 'User id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/VerificationDecisionRequest' }),
        responses: {
          200: successResponse('Verification decision applied'),
        },
      },
    },
    '/admin/users/{userId}/suspend': {
      post: {
        tags: ['Admin'],
        summary: 'Suspend a user (legacy route)',
        parameters: [uuidPathParam('userId', 'User id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/SuspendUserRequest' }),
        responses: {
          200: successResponse('User suspended'),
        },
      },
    },
    '/admin/users/{userId}/unsuspend': {
      post: {
        tags: ['Admin'],
        summary: 'Unsuspend a user',
        parameters: [uuidPathParam('userId', 'User id')],
        responses: {
          200: successResponse('User unsuspended'),
        },
      },
    },
    '/admin/teams/{teamId}/action': {
      post: {
        tags: ['Admin'],
        summary: 'Apply a team action (legacy route)',
        parameters: [uuidPathParam('teamId', 'Team id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/TeamActionRequest' }),
        responses: {
          200: successResponse('Team action applied'),
        },
      },
    },
    '/admin/tokens/generate': {
      post: {
        tags: ['Admin'],
        summary: 'Generate a token (legacy route)',
        requestBody: jsonBody({ $ref: '#/components/schemas/GenerateTokenRequest' }),
        responses: {
          200: successResponse('Token generated'),
        },
      },
    },
    '/admin/tokens/regenerate': {
      post: {
        tags: ['Admin'],
        summary: 'Regenerate a token',
        requestBody: jsonBody({ $ref: '#/components/schemas/GenerateTokenRequest' }),
        responses: {
          200: successResponse('Token regenerated'),
        },
      },
    },
    '/admin/export/students': {
      get: {
        tags: ['Admin'],
        summary: 'Export students as CSV',
        responses: {
          200: {
            description: 'CSV export',
            content: {
              'text/csv': {},
            },
          },
        },
      },
    },
    '/admin/export/teams': {
      get: {
        tags: ['Admin'],
        summary: 'Export teams as CSV',
        responses: {
          200: {
            description: 'CSV export',
            content: {
              'text/csv': {},
            },
          },
        },
      },
    },
    '/admin/export/submissions': {
      get: {
        tags: ['Admin'],
        summary: 'Export submissions as CSV',
        parameters: [{ $ref: '#/components/parameters/StageParam' }],
        responses: {
          200: {
            description: 'CSV export',
            content: {
              'text/csv': {},
            },
          },
        },
      },
    },
    '/admin/export/scores': {
      get: {
        tags: ['Admin'],
        summary: 'Export scores as CSV',
        responses: {
          200: {
            description: 'CSV export',
            content: {
              'text/csv': {},
            },
          },
        },
      },
    },
    '/admin/content/sponsors': {
      get: {
        tags: ['Admin'],
        summary: 'List sponsors',
        responses: {
          200: successResponse('Sponsors returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a sponsor',
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingAssetRequest' }),
        responses: {
          201: successResponse('Sponsor created'),
        },
      },
    },
    '/admin/content/sponsors/{sponsorId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a sponsor',
        parameters: [uuidPathParam('sponsorId', 'Sponsor id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingAssetRequest' }),
        responses: {
          200: successResponse('Sponsor updated'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a sponsor',
        parameters: [uuidPathParam('sponsorId', 'Sponsor id')],
        responses: {
          200: successResponse('Sponsor deleted'),
        },
      },
    },
    '/admin/content/partners': {
      get: {
        tags: ['Admin'],
        summary: 'List partners',
        responses: {
          200: successResponse('Partners returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a partner',
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingAssetRequest' }),
        responses: {
          201: successResponse('Partner created'),
        },
      },
    },
    '/admin/content/partners/{partnerId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a partner',
        parameters: [uuidPathParam('partnerId', 'Partner id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingAssetRequest' }),
        responses: {
          200: successResponse('Partner updated'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a partner',
        parameters: [uuidPathParam('partnerId', 'Partner id')],
        responses: {
          200: successResponse('Partner deleted'),
        },
      },
    },
    '/admin/content/faqs': {
      get: {
        tags: ['Admin'],
        summary: 'List FAQs',
        responses: {
          200: successResponse('FAQs returned'),
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create an FAQ',
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingFaqRequest' }),
        responses: {
          201: successResponse('FAQ created'),
        },
      },
    },
    '/admin/content/faqs/{faqId}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update an FAQ',
        parameters: [uuidPathParam('faqId', 'FAQ id')],
        requestBody: jsonBody({ $ref: '#/components/schemas/LandingFaqRequest' }),
        responses: {
          200: successResponse('FAQ updated'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete an FAQ',
        parameters: [uuidPathParam('faqId', 'FAQ id')],
        responses: {
          200: successResponse('FAQ deleted'),
        },
      },
    },
    '/admin/feedback/publish': {
      post: {
        tags: ['Admin'],
        summary: 'Publish feedback for one or more submissions',
        requestBody: jsonBody({ $ref: '#/components/schemas/PublishFeedbackRequest' }),
        responses: {
          200: successResponse('Feedback published'),
        },
      },
    },
  },
};
