# Verified public release from liush2yuxjtu

Play: https://liush2yuxjtu.github.io/graybox-drive/

Published source: `cb186f3f4c96545e25f805170c2ca4d14ab51a49`.
[Source verification, deployment and complete live verification](https://github.com/liush2yuxjtu/graybox-drive/actions/runs/43706891723) all succeeded on 2026-11-15. The original LiuShiyuMath site remains a historical deployment.

## Executed release gates

| Gate | Result |
| --- | --- |
| Source full verify | PASS, all 32 commands; normal three-lap keyboard race 65.42 seconds, two AI contacts |
| GitHub Pages deployment | PASS; only `dist` published |
| Live full verify | PASS, all 32 commands; all 15 runtime assets matched source; normal three-lap keyboard race 65.36 seconds, two AI contacts |
| Independent public-browser smoke | PASS: real acceleration, steering, braking, pause/resume, all three cameras, all five maps, visible cars and reachable controls |

The public-browser smoke covered 1536×643 and 390×844. Its screenshots remain in the Browser Use session outputs; they are not claimed as files committed here. Physical Android/iPhone hardware and performance remain separate acceptance items.

`github-pages-release.json` preserves the workflow/job results, source and runtime SHA-256 hashes, normal-race observations and artifact receipts. GitHub Actions artifacts contain the complete source/live screenshot and video evidence and expire according to the listed retention dates. The permanent original Git history and exported GT01 evidence remain in `backups/`.

This documentation commit records the successful published commit without changing its executable or workflow source. It does not require republishing identical runtime assets.
