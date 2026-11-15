# GitHub source save and CI runner repair

The dedicated repository is https://github.com/liush2yuxjtu/graybox-drive . Import commit `66347584641c489d3f27aef5e4356f0f1f53a9c0` preserves all 489 files from original verified commit `9ee8c283d3f3d8f3cc79916993f1d4dcbfc22766`. Its source tree is exactly `c543e4120706a6e8e721ac419e47e78cb98bd360`.

A fresh public GitHub clone verified all 588 imported source and backup file hashes. All seven reconstructed artifacts matched their SHA-256 manifests, and `git bundle verify` confirmed complete original history. The original import and bundle remain immutable; subsequent commits update repository-specific workflow configuration and documentation.

## Runner repair

The first Actions run failed during browser installation because `ubuntu-latest` selected Ubuntu 26.04, which pinned Playwright 1.51 does not support. All jobs now pin supported Ubuntu 24.04. Future live verification derives the deployment URL from the current repository owner and name.

## Local acceptance

The complete command `DRIVE_CHROMIUM_PATH=/usr/bin/chromium .venv/bin/python tests/verify.py` passed after the workflow changes: all 32 commands exited zero, with 614 screenshots and 8 videos. A normal keyboard race completed three earned laps in 67.521 seconds. The run used installed Chromium 156, Python and JS Playwright 1.51, and retains all 69 tested source hashes in `ci-runner-acceptance.json`. The record identifies the pre-commit parent and dirty worktree because it was produced before committing the verified changes.

The import and runner repair use `[verify only]`, so they verify without publishing a deployment. GitHub Actions status is available in the repository's Actions tab; this local record does not substitute for the CI result or physical-phone acceptance.
