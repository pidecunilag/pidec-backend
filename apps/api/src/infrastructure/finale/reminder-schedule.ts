import type { FinaleReminderType } from '../../domain/services/email-service.js';

type ReminderSchedule = {
  key: FinaleReminderType;
  startsAt: number;
  endsAt: number;
};

const schedules: ReminderSchedule[] = [
  {
    key: '3-days',
    startsAt: Date.parse('2026-08-25T08:00:00.000Z'),
    endsAt: Date.parse('2026-08-26T08:00:00.000Z'),
  },
  {
    key: '2-days',
    startsAt: Date.parse('2026-08-26T08:00:00.000Z'),
    endsAt: Date.parse('2026-08-27T08:00:00.000Z'),
  },
  {
    key: '1-day',
    startsAt: Date.parse('2026-08-27T08:00:00.000Z'),
    endsAt: Date.parse('2026-08-28T05:30:00.000Z'),
  },
];

export const getActiveFinaleReminder = (now = new Date()): FinaleReminderType | null => {
  const timestamp = now.getTime();
  return (
    schedules.find(({ startsAt, endsAt }) => timestamp >= startsAt && timestamp < endsAt)?.key ??
    null
  );
};
