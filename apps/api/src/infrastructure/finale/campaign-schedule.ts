const CAMPAIGN_START = Date.parse('2026-08-27T23:01:00.000Z');
const CAMPAIGN_END = Date.parse('2026-08-28T06:00:00.000Z');

export const isFinaleTomorrowCampaignActive = (now = new Date()): boolean => {
  const timestamp = now.getTime();
  return timestamp >= CAMPAIGN_START && timestamp < CAMPAIGN_END;
};
