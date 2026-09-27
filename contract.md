# Offline SPI response detector contract — version 1

User-approved acceptance: flag every recorded 32-bit SPI response that differs
from a trusted reference, with zero alarms on matching responses. This is a
defensive comparison tool, not a new trigger, payload, cipher, or CVSS score.

## Input and trust boundary

Reference JSON has exactly `schema_version: 1` and a `transactions` array of
objects with exactly `id` and `expected`. Observation JSON has the same top
fields and records with exactly `id` and `observed`. Words are exactly eight
ASCII hexadecimal digits; upper/lowercase are equivalent. Numbers, shortened
words, prefixes, unknown X/Z bits, nulls, and other coercions are invalid.

IDs are case-sensitive, nonempty strings of at most 128 UTF-16 code units,
with no leading/trailing whitespace or ASCII control characters. IDs must be
unique within each file. Alignment uses IDs, so row order is immaterial. The
tool does not infer transaction boundaries or identity from raw clock samples.

Reference must contain 1–100,000 transactions. Observations may contain
0–100,000. A nonempty reference and empty observations produces missing-ID
alarms. Unknown JSON fields are invalid. Each input file is at most 16 MiB.
Use a separately obtained trusted reference; agreement with a self-generated
or tampered reference does not establish correctness of the hardware.

The CLI requires a separately supplied SHA-256 for the exact reference file.
This detects reference changes; it does not authenticate who supplied the hash.

## Fixed outcomes

- **PASS / exit 0:** every reference ID is present exactly once, no unexpected
  IDs exist, and all normalized 32-bit words match. Zero alarms.
- **ALARM / exit 1:** one alarm for each mismatched, missing, or unexpected ID.
  Valid matching transactions do not raise alarms. Mismatched words include
  the expected and observed values and the differing bit positions.
- **INVALID / exit 2:** malformed/ambiguous input, duplicate IDs or JSON object
  keys, unknown fields/bits, empty reference, resource limits, unreadable input,
  or reference hash mismatch. Invalid evidence must never be reported as PASS.
  INVALID is an input-integrity failure, not a demonstrated hardware mismatch.

No payload-specific signature or special treatment of any data word is used.
No connection to hardware or networks occurs. The detector evaluates complete
offline recordings and claims no real-time latency or preventive capability.

## Invocation and reproducibility

`node scripts/spi-response-detector.cjs --reference reference.json --reference-sha256 HASH --observed observed.json --output result.json`

Output files must be new; existing files and inputs must never be overwritten.
Reports identify input hashes, detector hash/version, outcome, compared counts,
and alarms. Comparison is also exported as `compare(reference, observed)` for
isolated tests. Invalid inputs return an INVALID report rather than throwing.

## Evaluation fixed before implementation

Development checks cover matching, single/multiple-bit mismatches, every bit
position, row ordering, missing/unexpected IDs, rejected ambiguous inputs, and
reference integrity. Previously exposed project vectors are regression cases.
Separate synthetic held-out cases are prepared by an evaluator; parent does
not inspect their concrete words/answers before freezing the candidate hash.
No training occurs. Holdout is for implementation validation, not an estimate
of deployment prevalence or detection of all CVSS-10 vulnerabilities.

Accept only zero missed injected mismatches, zero false alarms on valid
matching records, and correct non-PASS handling of the invalid-input cases.
Retain failures and checkpoints; three unsuccessful attempts on one issue
require reassessment. Source RTL and the frozen submission archive remain
independent of this new detector.
