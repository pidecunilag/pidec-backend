import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFinaleTomorrowCampaignActive } from '../src/infrastructure/finale/campaign-schedule.js';

describe('Grand Finale midnight campaign schedule', () => {
  it('opens at 12:01 AM Lagos time on 28 August 2026', () => {
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-27T23:00:59.999Z')), false);
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-27T23:01:00.000Z')), true);
  });

  it('closes before the morning event-day reminder', () => {
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T05:59:59.999Z')), true);
    assert.equal(isFinaleTomorrowCampaignActive(new Date('2026-08-28T06:00:00.000Z')), false);
  });
});
