/**
 * Parse an HTTP Retry-After header (RFC 7231 §7.1.3).
 *
 * The header may be either:
 *   - delta-seconds: a non-negative integer number of seconds, or
 *   - HTTP-date: an IMF-fixdate (preferred) or RFC 850 or asctime date string.
 *
 * Decision (documented, not ambiguous): when given a delta-seconds value we
 * interpret it relative to the clock passed in, so `parseRetryAfter` returns
 * `clock() + seconds*1000`. This lets tests be deterministic. When given an
 * HTTP-date we return the instant it names, regardless of clock — the clock is
 * only consulted to compute the *delay* form.
 */

const HTTP_DATE_RX =
  /^(\w{3},\s)?(\d{2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{2}):(\d{2})\sGMT$/;

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseHttpDate(value) {
  // IMF-fixdate only, e.g. "Sun, 06 Nov 1994 08:49:37 GMT".
  // We deliberately support only this format: it's the one RFC 7231 mandates,
  // and the other two are explicitly obsolete. Servers in the wild overwhelmingly
  // emit IMF-fixdate; the rare RFC-850/asctime case is out of scope.
  const m = HTTP_DATE_RX.exec(value);
  if (!m) return null;
  const day = Number(m[2]);
  const month = MONTHS[m[3]];
  if (month === undefined) return null;
  const year = Number(m[4]);
  const hours = Number(m[5]);
  const minutes = Number(m[6]);
  const seconds = Number(m[7]);
  // Range sanity: protect against garbage like hour 99 silently wrapping via UTC().
  if (
    day < 1 ||
    day > 31 ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }
  const ts = Date.UTC(year, month, day, hours, minutes, seconds);
  const d = new Date(ts);
  // Date.UTC tolerates out-of-range components by rolling over; verify round-trip.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hours ||
    d.getUTCMinutes() !== minutes ||
    d.getUTCSeconds() !== seconds
  ) {
    return null;
  }
  return d;
}

/**
 * Parse a Retry-After header value into an absolute Date.
 *
 * @param {string|null|undefined} header
 * @param {() => number} [clock] - function returning current epoch ms.
 *   Defaults to Date.now. Inject a fake in tests so the result is independent
 *   of wall-clock time.
 * @returns {Date|null} the retry instant, or null if the value is missing or
 *   cannot be parsed.
 */
export function parseRetryAfter(header, clock = Date.now) {
  if (header === null || header === undefined) return null;
  const trimmed = String(header).trim();
  if (trimmed === "") return null;

  // Integer form: must be all digits. Leading + or - or decimal point is invalid
  // per the delta-seconds grammar, so we reject rather than coerce.
  if (/^[0-9]+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    // Guard against absurdly large values whose *1000 could overflow into NaN/Infinity.
    const MAX_MS = 8.64e15; // Date max epoch ms.
    const ms = seconds * 1000;
    if (!Number.isFinite(ms) || ms > MAX_MS) return null;
    return new Date(clock() + ms);
  }

  return parseHttpDate(trimmed);
}

/**
 * Parse a Retry-After header value into a delay in milliseconds from now.
 *
 * @param {string|null|undefined} header
 * @param {() => number} [clock] - function returning current epoch ms.
 * @returns {number|null} non-negative milliseconds to wait, or null if the
 *   value is missing/unparseable.
 */
export function parseRetryAfterDelay(header, clock = Date.now) {
  const when = parseRetryAfter(header, clock);
  if (when === null) return null;
  const delay = when.getTime() - clock();
  // A past HTTP-date yields a negative delay. Callers using setTimeout would
  // treat negatives as "fire immediately", so we floor at zero here rather than
  // push the decision onto every caller.
  return delay < 0 ? 0 : delay;
}
