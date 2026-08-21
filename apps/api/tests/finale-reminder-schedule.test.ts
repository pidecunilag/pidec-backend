import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActiveFinaleReminder } from '../src/infrastructure/finale/reminder-schedule.js';

describe('Grand Finale reminder schedule', () => {
  it('activates each countdown reminder at 9:00 AM Lagos time', () => {
    assert.equal(getActiveFinaleReminder(new Date('2026-08-25T07:59:59.999Z')), null);
    assert.equal(getActiveFinaleReminder(new Date('2026-08-25T08:00:00.000Z')), '3-days');
    assert.equal(getActiveFinaleReminder(new Date('2026-08-26T08:00:00.000Z')), '2-days');
    assert.equal(getActiveFinaleReminder(new Date('2026-08-27T08:00:00.000Z')), '1-day');
  });

  it('activates the D-day reminder at 8:00 AM Lagos time', () => {
    assert.equal(getActiveFinaleReminder(new Date('2026-08-28T06:59:59.999Z')), '1-day');
    assert.equal(getActiveFinaleReminder(new Date('2026-08-28T07:00:00.000Z')), 'event-day');
    assert.equal(getActiveFinaleReminder(new Date('2026-08-28T23:00:00.000Z')), null);
  });
});
