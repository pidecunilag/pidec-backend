import { Router } from 'express';
import { getLandingData } from '../controllers/landing-content-controller.js';
import { CreateFinaleRegistrationSchema, LookupFinaleCardSchema } from '@pidec/shared';
import {
  createFinaleRegistration,
  lookupFinaleCardRegistration,
  sendFinaleTomorrowCampaignTest,
} from '../controllers/finale-controller.js';
import { finaleLookupRateLimiter, registerRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';

const publicRouter = Router();

publicRouter.get('/landing-data', getLandingData);
publicRouter.post(
  '/finale/registrations',
  registerRateLimiter,
  validate(CreateFinaleRegistrationSchema),
  createFinaleRegistration,
);
publicRouter.post(
  '/finale/card-lookup',
  finaleLookupRateLimiter,
  validate(LookupFinaleCardSchema),
  lookupFinaleCardRegistration,
);
publicRouter.post('/finale/campaigns/tomorrow/test', sendFinaleTomorrowCampaignTest);

export { publicRouter };
