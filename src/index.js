/**
 * Public surface for http-retry-after-parse.
 *
 * We re-export from core.js so the public entry point is stable; consumers
 * import either `parseRetryAfter` (returns a Date when to retry) or
 * `parseRetryAfterDelay` (returns milliseconds from now to wait).
 */
export { parseRetryAfter, parseRetryAfterDelay } from "./core.js";
