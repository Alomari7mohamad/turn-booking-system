import test from "node:test";
import assert from "node:assert/strict";
import {
  REJECTION_MARKER,
  isAppointmentRejected,
  markAppointmentRejected,
} from "../src/utils/appointmentStatus.js";

test("marks a business rejection without losing existing notes", () => {
  const notes = markAppointmentRejected("ملاحظة سابقة");

  assert.equal(notes.includes("ملاحظة سابقة"), true);
  assert.equal(notes.includes(REJECTION_MARKER), true);
  assert.equal(isAppointmentRejected({ status: "CANCELLED", notes }), true);
});

test("does not expose a customer cancellation as a business rejection", () => {
  assert.equal(isAppointmentRejected({ status: "CANCELLED", notes: "" }), false);
  assert.equal(isAppointmentRejected({ status: "CONFIRMED", notes: REJECTION_MARKER }), false);
});

test("adding the rejection marker is idempotent", () => {
  const once = markAppointmentRejected("");
  const twice = markAppointmentRejected(once);

  assert.equal(twice, once);
});
