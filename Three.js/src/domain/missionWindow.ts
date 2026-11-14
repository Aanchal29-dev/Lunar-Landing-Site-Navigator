export type MissionWindow = { start_utc: string; duration_hours: number };

export const DEFAULT_MISSION_WINDOW: MissionWindow = {
  start_utc: "2026-11-20T00:00:00Z",
  duration_hours: 144,
};

export function assertMissionWindow(window: MissionWindow): MissionWindow {
  if (!Number.isInteger(window.duration_hours) || window.duration_hours < 1 || window.duration_hours > 336) {
    throw new Error("Duration must be a whole number from 1 to 336 hours.");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/.exec(window.start_utc);
  if (!match) {
    throw new Error("Start time must be an ISO 8601 UTC timestamp ending in Z.");
  }
  const [, year, month, day, hour, minute, second] = match;
  const values = [year, month, day, hour, minute, second].map(Number);
  if (values.some((value) => !Number.isInteger(value))) throw new Error("Start time is invalid.");
  const [utcYear, utcMonth, utcDay, utcHour, utcMinute, utcSecond] = values as [number, number, number, number, number, number];
  const date = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, utcMinute, utcSecond));
  if (date.getUTCFullYear() !== utcYear || date.getUTCMonth() !== utcMonth - 1 || date.getUTCDate() !== utcDay || date.getUTCHours() !== utcHour || date.getUTCMinutes() !== utcMinute || date.getUTCSeconds() !== utcSecond) {
    throw new Error("Start time is invalid.");
  }
  return window;
}

export function missionEndUtc(window: MissionWindow): string {
  const checked = assertMissionWindow(window);
  return new Date(Date.parse(checked.start_utc) + checked.duration_hours * 60 * 60 * 1000).toISOString().replace(".000Z", "Z");
}
