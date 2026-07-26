import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFreeIntervals,
  findFirstAvailableAlternative,
  generateDynamicCandidates,
  mergeIntervals,
} from "../src/services/intervalScheduling.service.js";

const options = {
  durationMinutes: 30,
  minDuration: 10,
  stepMinutes: 5,
};

test("حجز أول دور في اليوم يبقى متاحًا", () => {
  const candidates = generateDynamicCandidates({
    ...options,
    freeIntervals: [{ start_time: 9 * 60, end_time: 12 * 60 }],
  });

  assert.ok(candidates.some((item) => item.start_time === 9 * 60 && item.end_time === 9 * 60 + 30));
});

test("حجز آخر دور في اليوم متاح وله أولوية إنهاء الفجوة", () => {
  const candidates = generateDynamicCandidates({
    ...options,
    freeIntervals: [{ start_time: 9 * 60, end_time: 12 * 60 }],
  });
  const last = candidates.find((item) => item.start_time === 11 * 60 + 30);

  assert.deepEqual(last, { start_time: 690, end_time: 720, priority: 2 });
});

test("عند عدم وجود فجوة كافية يُقترح أول جدول بديل", () => {
  const alternative = findFirstAvailableAlternative([
    { date: "2026-07-20", freeIntervals: [{ start_time: 540, end_time: 560 }] },
    { date: "2026-07-21", freeIntervals: [{ start_time: 600, end_time: 660 }] },
  ], options);

  assert.equal(alternative.date, "2026-07-21");
  assert.ok(alternative.candidates.length > 0);
  assert.equal(alternative.candidates[0].start_time, 630);
});

test("إلغاء حجز يدمج أكثر من فجوتين متجاورتين", () => {
  const merged = mergeIntervals([
    { start_time: 540, end_time: 570 },
    { start_time: 570, end_time: 600 },
    { start_time: 600, end_time: 630 },
    { start_time: 630, end_time: 660 },
  ]);

  assert.deepEqual(merged, [{
    start_time: 540,
    end_time: 660,
    starts_after_appointment: false,
    ends_after_appointment: false,
  }]);
});

test("إعادة حساب الفجوات بعد الإلغاء تعيد الفترة كاملة", () => {
  const beforeCancellation = buildFreeIntervals({
    workingIntervals: [{ start_time: 540, end_time: 660 }],
    busyIntervals: [{ start_time: 570, end_time: 630, source: "appointment" }],
  });
  const afterCancellation = buildFreeIntervals({
    workingIntervals: [{ start_time: 540, end_time: 660 }],
    busyIntervals: [],
  });

  assert.equal(beforeCancellation.length, 2);
  assert.deepEqual(afterCancellation, [{
    start_time: 540,
    end_time: 660,
    starts_after_appointment: false,
  }]);
});

test("الفجوة المتبقية بطول min_duration تُقبل", () => {
  const candidates = generateDynamicCandidates({
    freeIntervals: [{ start_time: 540, end_time: 600 }],
    durationMinutes: 50,
    minDuration: 10,
    stepMinutes: 5,
  });

  assert.ok(candidates.some((item) => item.start_time === 540 && item.end_time === 590));
});

test("الفجوة المتبقية بطول min_duration - 1 تُرفض", () => {
  const candidates = generateDynamicCandidates({
    freeIntervals: [{ start_time: 540, end_time: 599 }],
    durationMinutes: 50,
    minDuration: 10,
    stepMinutes: 5,
  });

  assert.equal(candidates.length, 0);
});

test("الأوقات المتساوية في الأولوية تُرتب زمنيًا", () => {
  const candidates = generateDynamicCandidates({
    freeIntervals: [
      { start_time: 660, end_time: 720, starts_after_appointment: true },
      { start_time: 540, end_time: 600, starts_after_appointment: true },
    ],
    durationMinutes: 20,
    minDuration: 10,
    stepMinutes: 5,
  });
  const adjacent = candidates.filter((item) => item.priority === 1);

  assert.deepEqual(adjacent.map((item) => item.start_time), [540, 660]);
});
