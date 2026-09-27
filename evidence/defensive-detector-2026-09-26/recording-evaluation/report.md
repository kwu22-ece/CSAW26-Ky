# Independent recording-envelope evaluation — cycle 04

The frozen candidate passed **129 of 129 executed checks**. Two additional
planned file-symlink checks were not executed because Windows denied creation
of those synthetic symlinks (`EPERM`). This is 131 planned checks, 129 passes,
zero failures, and two explicit skips. No candidate source change or retest was
needed. Recommend retaining the optional envelope with the documented limits.

| Evaluation | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Main integrity/comparison contract | 123 | 0 | 2 |
| Copied-source integrity gates | 3 | 0 | 0 |
| Invalid UTF-8 embedded inside identifiers | 3 | 0 | 0 |
| Total | 129 | 0 | 2 |

## Frozen criteria, candidate, and independence

Fixed recording contract SHA-256:
`9424a54c5f05f08c4c1e1b4ae06df7c8b75961d22e64242d058596b160336de1`.
Comparison criteria remain the existing version-1 contract. Neither contract,
the synthetic expected outcomes, nor the independent map/XOR oracle was tuned
after evaluation.

Envelope `verify-spi-recording.cjs`, version 1.0.0, SHA-256:
`9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4`.
Comparator `spi-response-detector.cjs`, version 1.1.0, SHA-256:
`462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec`.
Source hashes remained identical after evaluation.

The evaluator did not inspect either target source implementation. It read the
fixed contracts and published prior report output for alarm-field names.
Fixture/evaluator commitments were saved before receipt of candidate hashes:
`commitment.json`, `code-gates-commitment.json`, and
`embedded-utf8-commitment.json`. The parent was given only aggregate coverage
until it froze the candidate. Generator seed is `0x6d0478b3`.

Environment: Windows x64, Node.js v24.16.0. All inputs are synthetic offline
JSON. No hardware, RTL, secret-knock exercise, bitstream, network, or exploitation
was involved.

## Evidence

Main valid evaluations contained 102,241 reference records and 102,233 observed
records across cases. Exact oracle comparison verified:

- 102,188 matching records with zero false alarms;
- 42 value mismatches, with all 32 possible bit positions covered;
- 11 missing and 3 unexpected records, with exact alarms;
- eight separately seeded 257-record matching trials;
- exact acceptance at 100,000 records, 16 MiB inputs, and a 64 KiB manifest;
- rejection beyond those limits, and correct strict-schema, decoded duplicate
  key, filename, invalid-ID, hash, code-version, and malformed-evidence results;
- byte preservation for inputs and pre-existing report destinations.

All valid output reports carried the expected recording identity, exact pinned
hashes, source identity, comparison summaries, alarms, and bit positions.
Invalid reports never claimed verified integrity or a successful comparison.

The source-gate probes used isolated copies only. An exact-copy control passed.
A comparator copy with a harmless local marker suffix and the original code
pin was rejected before executing the marker. A deliberately repinned copy
that changed its own copied file after an exported API call was rejected by
the post-call integrity check. The actual frozen source files were preserved.

Embedded-UTF-8 probes put invalid bytes inside otherwise-valid JSON string
identifiers. Lenient replacement decoding would still produce syntactically
valid JSON and matching transaction IDs; all three probes were correctly
rejected. This avoids confusing ordinary trailing-JSON failure with strict
UTF-8 validation.

Raw results: `cycle-04-main/results.json`,
`cycle-04-code-gates/results.json`, and
`cycle-04-embedded-utf8/results.json`. Every executed case retains its exact
inputs, pin-bearing manifest, CLI process result, and output report.

## Harness correction, preserved without criterion changes

The first main invocation aborted before reading the candidate or creating a
case. Its option-name regex incorrectly excluded digits even though its own
option names include `sha256`. The committed `evaluate.cjs` is unchanged.
`evaluate-fixed-cli.cjs` changes only `/^--[a-z-]+$/` to
`/^--[a-z0-9-]+$/`; `harness-cli-correction.json` records the error, zero target
cases executed, exact change, and before/after hashes. The parent was notified
before the corrected harness ran. No assertion, fixture, or oracle changed.

## Reproduction

Run from the workspace root with fresh output directories:

```powershell
node evidence/defensive-detector-2026-09-26/recording-evaluation/evaluate-fixed-cli.cjs --root . --envelope-sha256 9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4 --detector-sha256 462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec --run evidence/defensive-detector-2026-09-26/recording-evaluation/replay-main
node evidence/defensive-detector-2026-09-26/recording-evaluation/code-gates.cjs --root . --envelope-sha256 9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4 --detector-sha256 462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec --run evidence/defensive-detector-2026-09-26/recording-evaluation/replay-code-gates
node evidence/defensive-detector-2026-09-26/recording-evaluation/embedded-utf8.cjs --root . --envelope-sha256 9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4 --detector-sha256 462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec --run evidence/defensive-detector-2026-09-26/recording-evaluation/replay-embedded-utf8
```

## Remaining limits and next priority

These finite deterministic checks do not establish universal detection, a
deployment false-positive probability, or any CVSS score. The independently
trusted manifest pin is essential. Both trust-limit controls correctly accepted
a newly pinned coherent reference/observation pair or a renamed recording;
the envelope cannot decide whether an initially supplied reference, pairing,
identity, or capture time is true. Local runtime/filesystem trust also remains
an assumption, and the source checks are not runtime attestation.

The two real file-symlink cases remain unverified on this host; they were not
replaced with inferred passes. An appropriate next evaluation is to execute
those exact probes in an environment that already permits local synthetic
file symlinks, then independently validate capture identity and provenance.
No algorithm, gup scrambling, wobble rehearsal, secret wubble-knock, or score
was changed by this work.
