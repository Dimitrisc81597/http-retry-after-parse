import { test } from "node:test";
import assert from "node:assert/strict";

import { parseRetryAfter, parseRetryAfterDelay } from "../src/core.js";

// Fake, deterministic clock anchored at a fixed instant.
const FAKE_NOW_MS = Date.UTC(2023, 0, 1, 0, 0, 0); // 2023-01-01T00:00:00.000Z
const clock = () => FAKE_NOW_MS;

test("null/undefined/empty header returns null", () => {
  assert.equal(parseRetryAfter(null), null);
  assert.equal(parseRetryAfter(undefined), null);
  assert.equal(parseRetryAfter(""), null);
  assert.equal(parseRetryAfter("   "), null);
  assert.equal(parseRetryAfterDelay(null), null);
});

test("delta-seconds yields now + seconds", () => {
  const got = parseRetryAfter("90", clock);
  assert.equal(got.getTime(), FAKE_NOW_MS + 90_000);
});

test("zero delta-seconds yields exactly now", () => {
  assert.equal(parseRetryAfter("0", clock).getTime(), FAKE_NOW_MS);
});

test("whitespace-padded integer is accepted", () => {
  const got = parseRetryAfter("  120  ", clock);
  assert.equal(got.getTime(), FAKE_NOW_MS + 120_000);
});

test("HTTP-date yields that absolute instant regardless of clock", () => {
  const got = parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", clock);
  assert.equal(got.getTime(), Date.UTC(2015, 9, 21, 7, 28, 0));
});

test("delay from delta-seconds equals the delta", () => {
  assert.equal(parseRetryAfterDelay("30", clock), 30_000);
});

test("delay from future HTTP-date is the difference", () => {
  const future = "Wed, 21 Oct 2099 07:28:00 GMT";
  const expected = Date.UTC(2099, 9, 21, 7, 28, 0) - FAKE_NOW_MS;
  assert.equal(parseRetryAfterDelay(future, clock), expected);
});

test("delay from past HTTP-date is clamped to zero", () => {
  const past = "Wed, 21 Oct 1990 07:28:00 GMT";
  assert.equal(parseRetryAfterDelay(past, clock), 0);
});

test("signed or decimal integers are rejected", () => {
  // delta-seconds is defined as 1*DIGIT; we honor that literally.
  assert.equal(parseRetryAfter("+30", clock), null);
  assert.equal(parseRetryAfter("-30", clock), null);
  assert.equal(parseRetryAfter("1.5", clock), null);
});

test("nonsense string is rejected", () => {
  assert.equal(parseRetryAfter("not-a-date", clock), null);
  assert.equal(parseRetryAfterDelay("not-a-date", clock), null);
});

test("bad month name is rejected", () => {
  assert.equal(parseRetryAfter("Wed, 21 Xxx 2015 07:28:00 GMT", clock), null);
});

test("out-of-range hour is rejected rather than rolling over", () => {
  assert.equal(parseRetryAfter("Wed, 21 Oct 2015 25:28:00 GMT", clock), null);
  assert.equal(parseRetryAfter("Wed, 32 Oct 2015 07:28:00 GMT", clock), null);
});

test("RFC 850 (asctime) date is not supported", () => {
  // Documented scope decision: only IMF-fixdate is parsed.
  assert.equal(parseRetryAfter("Sun, 06-Nov-94 08:49:37 GMT", clock), null);
});
