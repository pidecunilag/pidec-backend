import { Router } from 'express';
import { getLandingData } from '../controllers/landing-content-controller.js';
import { CreateFinaleRegistrationSchema } from '@pidec/shared';
import { createFinaleRegistration } from '../controllers/finale-controller.js';
import { registerRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';

const publicRouter = Router();

publicRouter.get('/landing-data', getLandingData);
publicRouter.post(
  '/finale/registrations',
  registerRateLimiter,
  validate(CreateFinaleRegistrationSchema),
  createFinaleRegistration,
);

export { publicRouter };
