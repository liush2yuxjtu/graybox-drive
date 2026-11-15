# Graybox Drive repository backup

The source at the repository root matches original tested commit `9ee8c283d3f3d8f3cc79916993f1d4dcbfc22766` byte-for-byte. The new repository was initialized separately, so its import commit has a different commit ID.

- `original-history/` preserves the complete original Git history as a split Git bundle, with reconstruction instructions and SHA-256.
- `verified-run/` preserves the source ZIP, integration patch, selected verification evidence and material scenes, full normal-keyboard race recording, and original-speed eight-second excerpt. Its manifest lists every original file and checksum.
- The committed acceptance report is `../verification/gt01-acceptance/acceptance.md`.

Local full verification passed: 32 commands, 614 screenshots, eight videos, and a normal three-lap keyboard race in 66.154 seconds. These counts describe the complete local run; the exported evidence ZIP contains logs, frame data and selected screenshots rather than every intermediate screenshot.

This is a source backup. It does not claim a deployment of this repository, a CI pass, or physical-phone acceptance. The commit message retains `[verify only]` to run verification without publishing the old deployment workflow.
