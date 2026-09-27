# Optional recording envelope — fixed acceptance version 1

This extends evidence integrity around the existing offline comparator without
changing its fixed response-comparison criteria. It does not modify the gup
core, secret-wubble-knock, or wobble-rehearsal behavior.

## Invocation

`node scripts/verify-spi-recording.cjs --manifest recording.json --manifest-sha256 HASH --output NEW_RESULT.json`

The manifest is at most 64 KiB, UTF-8 JSON without duplicate decoded keys.
It has exactly these fields:

```json
{
  "schema_version": 1,
  "recording_id": "example-recording-1",
  "detector_version": "1.1.0",
  "detector_sha256": "64 lowercase hexadecimal digits",
  "reference": {"file": "reference.json", "sha256": "64 lowercase hexadecimal digits"},
  "observed": {"file": "observed.json", "sha256": "64 lowercase hexadecimal digits"}
}
```

`recording_id` follows the comparator's ID rules. SHA values in the manifest
must be exactly 64 lowercase hex digits. The detached CLI manifest hash accepts
either case. Schema and detector version must match exactly; no fallback is
allowed. The detector file is fixed by this utility's location in `scripts/`;
the manifest cannot select another executable or module.

Input filenames must be different simple basenames of at most 128 ASCII
characters, ending in `.json`, beginning with an alphanumeric, and containing
only alphanumerics, dot, hyphen, and underscore. Names are compared
case-insensitively for distinctness. Windows reserved device names are invalid.
Directories, parent-relative paths, alternate streams and symlinks are invalid.
Reference/observed files reside beside the manifest. Each is bounded to 16 MiB.

## Fixed outcomes and integrity

Before comparison, verify the detached manifest SHA, exact manifest schema,
current comparator version and source SHA, and the exact reference and observed
byte hashes. The same bounded-read buffers that are hashed must be decoded and
compared. Source hash is checked before loading and after comparison. The local
filesystem and Node runtime must still be trusted during execution; these checks
are not an adversarial runtime-attestation mechanism.

For verified inputs, the unchanged comparator decides PASS/exit 0 or ALARM/exit
1. Any evidence/schema/hash/code-version/path problem is INVALID/exit 2 with no
clean verdict, no silent fallback, and no overwrite of any existing file.
Existing inputs and output paths are preserved. Reports include recording ID,
the verified manifest/reference/observed/comparator hashes, envelope source
hash, and comparison details. If integrity validation fails, the report must
not claim that its inputs were verified.

This is integrity relative to a separately trusted manifest pin. It does not
authenticate the producer, validate the human-assigned recording ID, establish
capture time/freshness, or correct an initially wrong pairing/reference.
Mixing or editing files after a manifest was pinned is rejected; accepting a
new manifest hash from the same untrusted source would defeat that assurance.

## Evaluation fixed before implementation

Valid matching records must pass without alarms; valid differing/missing/
unexpected responses must retain the comparator's exact alarms. Independently
test changes to reference bytes, observed bytes, manifest bytes, declared hashes,
schema, version and recording ID; reject only changes inconsistent with the
trusted pin or contract. Cover duplicate keys, invalid UTF-8, malformed and
ambiguous filenames, size limits, output preservation and all mismatch bits.
Use synthetic records and saved ordinary results only; no wrapper execution.

No score is increased. The current v1 ZIP and cycle snapshots remain the
rollback checkpoint. Keep new code only if the original comparison regression
and the new integrity checks pass with their predeclared expectations.
