# http-retry-after-parse

Parses an HTTP `Retry-After` header value into a concrete `Date` (when to retry) or a delay in milliseconds (how long to wait). Handles both the `delta-seconds` and IMF-fixdate forms defined by RFC 7231.

```js
import { parseRetryAfter, parseRetryAfterDelay } from "http-retry-after-parse";

// Absolute retry instant.
const when = parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT");

// Milliseconds to wait from now. A past HTTP-date is clamped to 0.
const waitMs = parseRetryAfterDelay("30");

// Deterministic testing: inject a clock.
const fixed = parseRetryAfter("90", () => 1_700_000_000_000);
```

## Why

Every retrying HTTP client eventually re-implements this parsing, usually badly: it forgets the HTTP-date variant, treats negative delays as "retry immediately" inconsistently, or sleeps against the wall clock in tests. This library does one thing — turn the header into a number or a `Date` — and takes a clock function so callers can test without touching real time.

## Decisions and edges you will hit

- Only IMF-fixdate (`Sun, 06 Nov 1994 08:49:37 GMT`) is supported. RFC 7231 lists two obsolete date formats; they are not parsed. If your server emits one, you get `null`.
- `delta-seconds` must be a bare non-negative integer (`1*DIGIT`). `+30`, `-30`, and `1.5` return `null` rather than being coerced.
- `parseRetryAfterDelay` clamps past HTTP-dates to `0` so the result can be handed straight to `setTimeout`. If you need the raw signed difference, call `parseRetryAfter(...).getTime() - Date.now()` yourself.
- A `clock` argument (defaulting to `Date.now`) is used only to interpret `delta-seconds`; HTTP-date values name a fixed instant and do not depend on it.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

