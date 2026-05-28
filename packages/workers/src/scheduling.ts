import { sql } from "./db.js";

interface TimingRule {
  delay_min_minutes: number;
  delay_max_minutes: number;
  enforce_business_hours: boolean;
  business_hours_start: string;
  business_hours_end: string;
  timezone: string;
  send_in_prospect_timezone: boolean;
}

/**
 * Calculates the scheduled send time for a reply based on timing_rules.
 *
 * Algorithm:
 * 1. Load timing_rule for client+intent from DB.
 * 2. Pick a random delay in [delay_min_minutes, delay_max_minutes].
 * 3. If enforce_business_hours, push the send time into the next valid
 *    business hours window (respecting prospect timezone when available).
 * 4. Falls back to a 15-minute delay when no timing rule is configured.
 */
export async function calculateSendTime(
  clientId: string,
  intent: string,
  prospectTimezone?: string | null,
  fallbackDelayMinutes = 15
): Promise<Date> {
  const [rule] = await sql<TimingRule[]>`
    SELECT
      delay_min_minutes,
      delay_max_minutes,
      enforce_business_hours,
      business_hours_start::text,
      business_hours_end::text,
      timezone,
      send_in_prospect_timezone
    FROM timing_rules
    WHERE client_id = ${clientId}::uuid
      AND intent   = ${intent}
  `;

  if (!rule) {
    return addMinutes(new Date(), fallbackDelayMinutes);
  }

  const { delay_min_minutes: minM, delay_max_minutes: maxM } = rule;

  // Suppression intents have 0-0 window → send immediately
  if (minM === 0 && maxM === 0) {
    return new Date();
  }

  const delayMinutes = randomBetween(minM, maxM);
  const candidate = addMinutes(new Date(), delayMinutes);

  if (!rule.enforce_business_hours) {
    return candidate;
  }

  const tz =
    rule.send_in_prospect_timezone && prospectTimezone
      ? prospectTimezone
      : rule.timezone;

  return enforceBusinessHours(
    candidate,
    tz,
    rule.business_hours_start,
    rule.business_hours_end
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns the time in [hours, minutes] extracted in the given IANA timezone.
 * Falls back to UTC on invalid timezone strings.
 */
function getLocalTime(date: Date, timezone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);

    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const hour = get("hour");
    return {
      hour: hour === 24 ? 0 : hour, // some locales return 24 for midnight
      minute: get("minute")
    };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}

/**
 * Returns the UTC offset in minutes for a given timezone at a specific instant.
 * Used to convert a "wall-clock" time in the target zone back to UTC.
 */
function getUTCOffsetMinutes(date: Date, timezone: string): number {
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
    return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60_000;
  } catch {
    return 0;
  }
}

/**
 * Parses "HH:MM:SS" or "HH:MM" into { hour, minute }.
 */
function parseTime(t: string): { hour: number; minute: number } {
  const [h = "0", m = "0"] = t.split(":");
  return { hour: parseInt(h, 10), minute: parseInt(m, 10) };
}

/**
 * Enforces business hours: if the candidate time falls outside [start, end),
 * moves it to the next valid window boundary.
 * Weekends (Saturday=6, Sunday=0) are skipped to Monday.
 */
function enforceBusinessHours(
  candidate: Date,
  timezone: string,
  businessStart: string,
  businessEnd: string
): Date {
  const start = parseTime(businessStart);
  const end = parseTime(businessEnd);

  const startDayMinutes = start.hour * 60 + start.minute;
  const endDayMinutes = end.hour * 60 + end.minute;

  let date = new Date(candidate);

  // Guard against infinite loop (max 7 iterations — worst case: skip a full week)
  for (let i = 0; i < 7; i++) {
    const { hour, minute } = getLocalTime(date, timezone);
    const dayMinutes = hour * 60 + minute;

    // Check for weekends
    const weekday = getWeekday(date, timezone);
    if (weekday === 0 || weekday === 6) {
      // Move to Monday at business start
      const daysUntilMonday = weekday === 0 ? 1 : 2;
      date = addMinutes(date, daysUntilMonday * 24 * 60 - dayMinutes + startDayMinutes);
      continue;
    }

    if (dayMinutes >= startDayMinutes && dayMinutes < endDayMinutes) {
      // Within business hours — done
      return date;
    }

    if (dayMinutes < startDayMinutes) {
      // Before business hours today — advance to start time
      const minutesUntilStart = startDayMinutes - dayMinutes;
      date = addMinutes(date, minutesUntilStart);
      continue;
    }

    // After business hours — jump to next day's start
    const minutesUntilNextDayStart = 24 * 60 - dayMinutes + startDayMinutes;
    date = addMinutes(date, minutesUntilNextDayStart);
  }

  return date;
}

/**
 * Returns the day of week (0=Sunday … 6=Saturday) in the given timezone.
 */
function getWeekday(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short"
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "weekday")?.value ?? "";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  } catch {
    return date.getUTCDay();
  }
}

// keep getUTCOffsetMinutes available for future use (timezone conversion)
void getUTCOffsetMinutes;
