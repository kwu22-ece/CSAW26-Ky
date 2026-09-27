# Ordinary-core simulation

This addition contains the recovered, unmodified word-transformer model, its port adapter, Yosys iCE40 primitive simulation models, the ordinary functional testbench, and the existing Node.js runner. It does not contain the Trojan wrapper or its activation testbench.

## Run

Use Node.js and the pinned OSS CAD Suite release recorded in `environment/ordinary-core-toolchain.json`. Set `OSS_CAD_ROOT` to your suite's `oss-cad-suite` directory, or use the existing default `environment/oss-cad-20260104/oss-cad-suite` layout. Installed toolchains are not included in this repository.

```powershell
$env:OSS_CAD_ROOT = 'C:\path\to\oss-cad-suite'
node scripts/run-core-functional.cjs evidence/ordinary-core-replay-01
```

Choose a new output directory. The runner refuses an existing directory and records separate compilation/simulation command logs. It compiles exactly `rtl/core.sim.v`, `rtl/reference_top.v`, `rtl/cells_sim.v`, and `tb/validation/core_functional_tb.sv`.

The existing testbench evaluates both inverse directions for 328 deterministic words at 50 kHz and 1 MHz, the published known-answer pair, and ordinary shift behavior for transfer lengths 1 through 31. A deliberately incorrect known-answer control must fail. Short-transfer coverage does not establish a malformed-frame detector. The saved reference CSVs and manifest are under `evidence/effectiveness-2026-09-26/core-run-01/`.

The source hashes match that recorded baseline. Publication did not change the source or run a new simulation. Saved passing results are offline simulation evidence; the same deterministic inputs at two rates are not independent samples. Hashes provide local byte integrity, not independently approved provenance, live-hardware verification, cipher-strength proof, or a CVSS score.

## Source credit

The recovered core derives from the supplied challenge configuration, originally documented at source commit `6bdf9e1d2f4ab1d59e3fb58980eb07062e1ca113` in `kwu22-ece/Sillytastic-Working-Challenge`. The simulation model has the previously documented Icarus-compatible port-header adaptation; no new logic change is included here. Preserve `inputs/original/ATTRIBUTION.md` and `inputs/original/LICENSE`.

`rtl/cells_sim.v` is byte-identical to the included suite's `share/yosys/ice40/cells_sim.v`. The suite's Yosys and IceStorm license notices are reproduced under `THIRD_PARTY_LICENSES/`. The repository's pre-existing root license has not been changed; this publication does not relicense third-party material. See `THIRD_PARTY_NOTICES.md`.
