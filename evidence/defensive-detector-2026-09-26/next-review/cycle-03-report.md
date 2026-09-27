# Independent cycle 03 review

**Retain the reader and parser resource changes.** No regression was found in
the independent checks. All evaluations used frozen detector 1.1.0, SHA-256
`fb26ff735cd6c76fa9af4cff7edf86f4ffec2f1166cd65b695d9d6e7e47de899`.
The implementation was not adjusted after these results.

| Check | Result |
| --- | --- |
| Unchanged 16-case reader/CLI regression | 16/16 passed |
| Unchanged 10-trial tiny-file resource probe | 10/10 passed; correct input/source hashes |
| Previously exposed maximum valid recording | 100,000 matching records, PASS, zero alarms |
| Small modeled reader states | 5/5 passed; descriptors always closed |
| Candidate source throughout evaluation | Unchanged |

The modeled cases cover an unchanged four-byte read, an unchanged empty read,
growth by one byte, truncation, and a final size change after an otherwise
complete read. They use a local filesystem API model with small harmless bytes.
They do not stress resource limits or prove filesystem snapshot atomicity.

## Resource comparison

Both versions were run in ten fresh Node.js processes against the same 90-byte
reference and observation JSON documents, using the unchanged probe.

| Median process-exit measure | Version 1.0.0 | Version 1.1.0 |
| --- | ---: | ---: |
| ArrayBuffer bytes | 33,591,345 | 37,489 |
| External bytes | 35,490,184 | 1,936,328 |
| RSS bytes | 74,657,792 | 41,390,080 |
| Elapsed milliseconds | 55.5365 | 51.7559 |

The ArrayBuffer accounting fell by about 99.89%; external accounting fell by
about 94.54%. These process-exit snapshots establish the small-file allocation
improvement under measured conditions. They are not peak live-memory bounds or
deployment timing guarantees. Startup and scheduling noise limit interpretation
of the elapsed-time difference; timing was not an acceptance criterion.

The strict parser now budgets 400,010 values. A complete legitimate
100,000-record document uses 300,003 values, and the independent CLI boundary
check confirmed it is still accepted. The budget addresses the static
container-count concern identified in the baseline review. No large malformed
input stress or deployment attack was run.

## Limits and next priority

The reader detects size-changing reads, not all concurrent equal-length edits.
It hashes the bytes it actually read. It does not prove a producer identity or
an atomic recording snapshot. Reference correctness and transaction identity
remain external assumptions. A separately pinned recording envelope can bind
the reference, observations, and comparator identity and should retain these
limits explicitly.

Raw evidence is in `candidate-v1-1/summary.json`,
`reader-candidate-v1-1/summary.json`, and
`boundary-and-reader-model-v1-1/summary.json`. Baselines remain in
`baseline-v1/summary.json` and `reader-baseline-v1/summary.json`.

## Final source verification

The final comparator source SHA-256 is
`462c5c178940aefb0d6a64e2f94f071ee7a2d7d3dd86bb93f55c0253714f91ec`.
The only reported change from the earlier frozen candidate was the reader
comment clarifying that *size-changing* captures fail closed. The independent
checks were nevertheless repeated at this exact source identity, preserving
all previous evidence.

The unchanged 16 reader regressions and ten tiny-file trials passed again.
The 100,000-record valid boundary and all five small modeled reader cases also
passed. Median final process-exit ArrayBuffer accounting was 37,490 bytes,
external accounting was 1,936,329 bytes, and RSS was 41,394,176 bytes. No
timing or memory guarantee beyond these observed conditions is inferred.
Final evidence is in `final-v1-1/summary.json`,
`reader-final-v1-1/summary.json`, and
`boundary-and-reader-model-final-v1-1/summary.json`.

## Read-only recording-envelope review

Reviewed `scripts/verify-spi-recording.cjs` SHA-256
`9ad0a12d025cf4a2dda95316a056985ed0dd7888da2b9b9d753720cb765aada4`
against the fixed `recording-contract.md`. No material correctness issue was
identified under its explicitly stated trusted-local-filesystem and Node
runtime assumptions. The implementation binds the detached manifest pin,
fixed comparator location/version/source, simple colocated filenames, and
reference/observation byte buffers. It rejects integrity failures before
issuing a clean comparison and retains exclusive output creation.

This was source review only. The reviewer did not inspect any
`recording-evaluation` fixtures, execute the envelope, or alter its code.
Independent envelope evaluation is separate evidence. Existing limitations
remain: the pin must be independently trustworthy; it does not authenticate
the producer, prove capture freshness, validate human-assigned identity, or
repair an initially incorrect reference/pairing.
