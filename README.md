# Offline SPI detector 1.1.0

Compare recorded 32-bit SPI responses against a trusted reference. Different,
missing, or unexpected transaction IDs produce ALARM; matching responses remain
unflagged. Malformed or unverified evidence produces INVALID. This release adds
smaller input-buffer allocations and an optional pinned recording manifest.

Requires Node.js; verified on v24.16.0 on Windows. Built-in modules only.
The archive is a separate offline utility, not the hardware submission.

## Packaged examples

From the extracted package root in PowerShell:

```powershell
$recordingPins = Get-Content examples/manifest-pins.json -Raw | ConvertFrom-Json
node scripts/verify-spi-recording.cjs --manifest examples/matching-recording.json --manifest-sha256 $recordingPins.matching --output matching-result.json
node scripts/verify-spi-recording.cjs --manifest examples/faults-recording.json --manifest-sha256 $recordingPins.faults --output faults-result.json
```

The matching example has 1,384 ordinary saved responses and returns PASS/0.
The copied-observation example has 1,384 harmless bit changes and returns
ALARM/1. Choose a new result filename on every run. The example pin file is
provided for reproducibility; it is not proof of who captured the data.

For other recordings, use the exact schemas and filenames in `contract.md` and
`recording-contract.md`. Establish the manifest SHA through a separately trusted
path. Recomputing and accepting a pin from an untrusted source defeats its
integrity assurance. The input limit is 16 MiB and 100,000 records per file.

The original comparison CLI remains available:

```text
node scripts/spi-response-detector.cjs --reference REFERENCE.json --reference-sha256 TRUSTED_HASH --observed OBSERVED.json --output NEW_RESULT.json
```

| Outcome | Exit | Meaning |
| --- | ---: | --- |
| PASS | 0 | Verified inputs match; no alarms |
| ALARM | 1 | Verified inputs contain differing/missing/unexpected responses |
| INVALID | 2 | Evidence, invocation, integrity or output validation failed |

For the original CLI, verification covers the reference pin and syntax; use the
optional envelope to bind both inputs and comparator identity. The raw compare
API returns comparison data only, without file provenance.

## Evidence and limits

See `report.md` for cycle decisions and evidence, and the independent reports
under `evidence/defensive-detector-2026-09-26/`. Earlier 897-check regression:
all passed. New integrity evaluation: 129 executed cases passed; two Windows
symlink cases skipped. Full fixtures and raw traces remain in the workspace.

This checks recorded words. It does not authenticate their producer, prove
capture freshness, infer framing/IDs, guarantee atomic reads, measure live alarm
latency, or detect faults invisible in the observed words. The local runtime and
filesystem must be trusted during verification. Reference correctness remains
an external prerequisite. No CVSS or universal detection score follows from a
passing comparison. Existing project terminology and hardware are unchanged.
