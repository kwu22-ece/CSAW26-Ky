# Defensive improvement cycles 03–04

Retain comparator 1.1.0 and the optional recording envelope 1.0.0. Both focused
changes improve the accepted offline workflow without changing comparison
criteria. All executed checks passed; two file-symlink probes remain unverified
because this Windows environment denied creating their test links.

## Frozen identities and recovery

| Artifact | SHA-256 |
| --- | --- |
| Comparator 1.1.0 | `462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec` |
| Envelope 1.0.0 | `9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4` |
| Original comparison contract | `88f4c61eaaaf9aefc1ebd9b28c8607186ed48866ffa8044611e713e94a6a74fc` |
| Additional recording contract | `9424a54c5f05f08c4c1e1b4ae06df7c8b75961d22e64242d058596b160336de1` |

The pre-change files and hashes are preserved in `checkpoints/before-cycle-03/`.
The original v1 ZIP remains the executable rollback release. Final source copies
and result hashes are collected in `checkpoints/cycles-03-04/` and
`final-manifest-v1-1.json`. Nothing here updates the original hardware submission.

## Cycle 03: reduce small-recording allocation

Hypothesis: allocating for the actual file size plus one growth sentinel will
remove unnecessary input buffers while preserving the 16 MiB input ceiling and
all comparison outcomes. A parser value budget can bound malformed container
counts while still accepting the documented 100,000-record maximum.

Change: bounded regular-file reads now allocate from the observed size, reject
size changes, and close the descriptor on all tested paths. The strict parser
admits at most 400,010 values; a maximum valid document uses 300,003. Only the
version and reader/parser resource handling changed. No comparison rule changed.

Independent trials used the same 90-byte reference/observation documents in ten
fresh Node.js v24.16.0 processes on Windows for each version. Median ArrayBuffer
accounting at process exit fell from 33,591,345 bytes to 37,490 bytes (99.89%).
Median external accounting fell from 35,490,184 to 1,936,329 bytes (94.54%).
These are measured process-exit snapshots, not peak-memory or latency guarantees.

The final source passed 16/16 independent reader checks, 10/10 repeated resource
checks, five small modeled reader-state checks, and the 100,000-record valid
boundary. The intermediate source was also tested; its only later change was
clarifying a comment to say *size-changing* captures fail closed. Final checks
were repeated at the final hash. See `next-review/cycle-03-report.md`.

Decision: keep. Size checks do not establish atomic snapshots or detect every
equal-length concurrent edit. The subsequent integrity envelope binds the bytes
actually read, subject to its trusted local runtime/filesystem assumption.

## Cycle 04: bind recording inputs and comparator identity

Hypothesis: a separately pinned manifest binding reference bytes, observation
bytes, and comparator version/source will reject accidental mixing or edits
after the pin was established, while preserving all valid comparison outcomes.

Change: add `scripts/verify-spi-recording.cjs` as an optional wrapper. It checks
the detached manifest hash, strict schema, bounded colocated input files, exact
input byte hashes, and fixed comparator identity. The source pin is checked
before loading the comparator and again after comparison. The exact hashed
buffers are decoded and compared. Integrity failures return INVALID with no
verified comparison. Existing output files are preserved.

An independent agent froze synthetic cases without inspecting implementation;
the candidate was pinned before evaluation and never tuned to these answers.
The main 125-case suite passed 123, failed zero, and skipped two file-symlink
probes with Windows EPERM. Six supplemental source-integrity/UTF-8 cases passed.
Thus **129/129 executed cases passed; 2/131 were not executed**. Among valid
comparisons, 102,188 matching records produced zero false alarms; all 42 word
mismatches, 11 missing IDs, and three unexpected IDs were correctly reported.
Mismatch cases cover all 32 bit positions. Most matching records come from the
100,000-record boundary fixture, not independent deployment observations.

One evaluator invocation aborted before any case because its own argument-name
regex rejected digits in `--*-sha256`. The original evaluator was preserved and
a separately hashed copy corrected only that regex. Fixtures, oracle, criteria,
and candidate were unchanged. This was a harness repair, not an improved model
result. See `recording-evaluation/report.md` and `harness-cli-correction.json`.

Decision: keep, with the two explicit environment skips. Independent source
review found no material issue under the fixed local-trust assumptions. Four
exposed development cases and their output-preservation checks also passed.

## Regression comparison

| Evaluation | Final result |
| --- | --- |
| Original exposed development checks | 50/50 passed |
| Small parser-budget development checks | 10/10 passed |
| Earlier holdout, now an exposed regression | 897/897 checks across 237 cases passed |
| Saved ordinary project responses | 1,384 matched; zero false alarms |
| Harmless one-bit changes to copied project observations | 1,384/1,384 detected |
| Reordered / missing / unexpected project records | All prior expectations preserved |

The old regression evaluator's only adaptation was its expected version string
from 1.0.0 to 1.1.0. The original evaluator and a one-change audit remain under
`holdout/`. All outcome, alarm, invalid-input, repeatability and nonmutation
expectations remain unchanged. Repeating exposed checks is not a new holdout.
Record counts across these suites are not pooled as independent samples.

No candidate repair was required. One harness repair and the nonbehavioral
comment clarification are recorded above; neither resets an attempt budget.

## Best supported result and remaining work

The best verified result is zero missed expected alarms and zero false alarms
in these finite offline evaluations, with substantially reduced small-file
allocation and a new integrity gate. No 10.0 quality score or universal CVSS-10
detection claim is made. The supplied CVSS vector's conditional 9.0 severity
remains separate from detector effectiveness.

Gup scrambling/unscrambling, the secret wubble-knock, and wobble rehearsal retain
their established meanings. Their source and prior evidence remain unchanged.
Only the six previously saved ordinary rehearsal responses are included in the
project detector regression; other phases remain unscored here.

Next priority: define and validate the trusted producer/reference path, including
who establishes the detached pin and transaction identities. Hashes do not
authenticate a producer, establish freshness, or repair an initially wrong
pairing. Live capture, framing, missed samples, alarm latency, and defects that
leave observed words unchanged remain outside this contract. Completing the two
symlink probes requires a link-capable test environment; no privilege change was
made. These gaps require concrete deployment facts before affected behavior or
acceptance criteria can be changed.
