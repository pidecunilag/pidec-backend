import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFinaleTomorrowCampaignActive } from '../src/infrastructure/finale/campaign-schedule.js';

describe('Grand Finale morning campaign schedule', () => {
  it('opens at 6:30 AM Lagos time on 28 August 2026', () => {
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T05:29:59.999Z')), false);
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T05:30:00.000Z')), true);
  });

  it('closes at 8:00 AM Lagos time', () => {
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T06:59:59.999Z')), true);
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T07:00:00.000Z')), false);
  });
});
