const DEFAULT_STEP_MINUTES = 5;

function validInterval(interval) {
  return Number.isFinite(interval?.start_time)
    && Number.isFinite(interval?.end_time)
    && interval.end_time > interval.start_time;
}

export function mergeIntervals(intervals = []) {
  const sorted = intervals
    .filter(validInterval)
    .map((interval) => ({ ...interval }))
    .sort((a, b) => a.start_time - b.start_time || a.end_time - b.end_time);

  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    const endsAfterAppointment = interval.ends_after_appointment
      ?? interval.source === "appointment";

    if (!last || interval.start_time > last.end_time) {
      merged.push({
        start_time: interval.start_time,
        end_time: interval.end_time,
        starts_after_appointment: Boolean(interval.starts_after_appointment),
        ends_after_appointment: Boolean(endsAfterAppointment),
      });
      continue;
    }

    if (interval.end_time > last.end_time) {
      last.end_time = interval.end_time;
      last.ends_after_appointment = Boolean(endsAfterAppointment);
    } else if (interval.end_time === last.end_time) {
      last.ends_after_appointment = last.ends_after_appointment || Boolean(endsAfterAppointment);
    }
  }

  return merged;
}

export function buildFreeIntervals({ workingIntervals = [], busyIntervals = [] }) {
  const working = mergeIntervals(workingIntervals);
  const busy = mergeIntervals(busyIntervals);
  const free = [];

  for (const window of working) {
    let cursor = window.start_time;
    let startsAfterAppointment = false;

    for (const occupied of busy) {
      if (occupied.end_time <= window.start_time) continue;
      if (occupied.start_time >= window.end_time) break;

      const occupiedStart = Math.max(window.start_time, occupied.start_time);
      const occupiedEnd = Math.min(window.end_time, occupied.end_time);

      if (occupiedStart > cursor) {
        free.push({
          start_time: cursor,
          end_time: occupiedStart,
          starts_after_appointment: startsAfterAppointment,
        });
      }

      if (occupiedEnd >= cursor) {
        cursor = Math.max(cursor, occupiedEnd);
        startsAfterAppointment = occupiedEnd === occupied.end_time
          && occupied.ends_after_appointment;
      }

      if (cursor >= window.end_time) break;
    }

    if (cursor < window.end_time) {
      free.push({
        start_time: cursor,
        end_time: window.end_time,
        starts_after_appointment: startsAfterAppointment,
      });
    }
  }

  return mergeIntervals(free).map(({ start_time, end_time, starts_after_appointment }) => ({
    start_time,
    end_time,
    starts_after_appointment,
  }));
}

export function generateDynamicCandidates({
  freeIntervals = [],
  durationMinutes,
  minDuration,
  stepMinutes = DEFAULT_STEP_MINUTES,
  notBefore = -Infinity,
}) {
  const duration = Number(durationMinutes);
  const minimum = Number(minDuration);
  const step = Math.max(1, Number(stepMinutes) || DEFAULT_STEP_MINUTES);
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (!Number.isFinite(minimum) || minimum <= 0) return [];

  const byStart = new Map();

  for (const gap of mergeIntervals(freeIntervals)) {
    if (gap.end_time - gap.start_time < duration) continue;

    const latestStart = gap.end_time - duration;
    const possibleStarts = new Set([gap.start_time, latestStart]);
    const firstGridStart = Math.ceil(gap.start_time / step) * step;
    for (let start = firstGridStart; start <= latestStart; start += step) {
      possibleStarts.add(start);
    }

    for (const start_time of possibleStarts) {
      if (start_time < gap.start_time || start_time > latestStart || start_time < notBefore) continue;

      const end_time = start_time + duration;
      const before = start_time - gap.start_time;
      const after = gap.end_time - end_time;
      const beforeUsable = before === 0 || before >= minimum;
      const afterUsable = after === 0 || after >= minimum;
      if (!beforeUsable || !afterUsable) continue;

      const priority = start_time === gap.start_time && gap.starts_after_appointment
        ? 1
        : end_time === gap.end_time
          ? 2
          : 3;
      const candidate = { start_time, end_time, priority };
      const existing = byStart.get(start_time);
      if (!existing || candidate.priority < existing.priority) byStart.set(start_time, candidate);
    }
  }

  return [...byStart.values()].sort(
    (a, b) => a.priority - b.priority || a.start_time - b.start_time || a.end_time - b.end_time,
  );
}

export function findFirstAvailableAlternative(schedules, options) {
  for (const schedule of schedules || []) {
    const candidates = generateDynamicCandidates({
      ...options,
      freeIntervals: schedule.freeIntervals,
      notBefore: schedule.notBefore ?? options?.notBefore,
    });
    if (candidates.length) return { ...schedule, candidates };
  }
  return null;
}
