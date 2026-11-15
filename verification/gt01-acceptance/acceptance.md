# GT01 local acceptance — 2026-11-15

The complete `.venv/bin/python tests/verify.py` entry passed on the frozen working tree based on `d2182d9`. All 69 recorded source hashes still match. The machine-readable [result](results.json) preserves the tested hashes and every command's exit status and elapsed time; local executable paths are normalized for publication. Full raw logs and captures are backed up in the project Page.

| Check | Actual result |
| --- | --- |
| Complete entry | 32 commands, every exit code 0, no skipped command |
| Formal models | 12 exhaustive TLC models, 1,089,456 distinct states; 31 expected named counterexamples detected |
| Browser evidence | 614 screenshots and 8 real-animation recordings |
| Vehicle visibility | 486 paired regions; whole-player missing-mesh controls retained |
| Native flicker and resource recovery | 540 native frames, 27 checks, two full-occlusion fixtures, four positive partial fixtures and two subpixel transitions |
| Camera | 450 actual physics frames across WebGL/Canvas and three sizes; original cameras retained |
| Python browser E2E | 30 actual-animation/input checks and 40 screenshots |
| Computer cars | 93 checks, 61 screenshots and one native-animation recording |
| Material shaders | 20 scenes over five maps, first/chase views and two orientations; real shader execution and context recovery |
| Earned three-lap race | 66.15 seconds, 3 physical AI contacts, 1011 native frames; saved score and frozen finish ranking |

The browser was Chromium 156.0.8078.79 with Python/JavaScript Playwright 1.51.0. Software GPU rendering uses the actual material shader at the economy profile; the separate Canvas depth fallback also executes. The observed race frame intervals were p50 66.6 ms and p95 100.0 ms on the shared host. These measurements do not establish 60 FPS or physical-phone performance.

The mountain partial-occlusion regression compares the exact car-only mask with fresh renderer resources at the same pose/backend, preserving the RGB difference threshold and all ordinary area/width/height limits. All four positive partial poses reject a deliberately missing whole player mesh. Zero-pixel subpixel poses must agree with a fresh full-mesh reference. Automatic recovery, exactly one five-second penalty and visible recovery remain required. A supplemental 180-step boundary sweep passed in both renderers and all three sizes.

Visual review covered the 20 material scenes plus fallback/restoration, all six camera beam captures, both orientations/backends of body feedback, and actual sampled frames from all six impact/fall/recovery recordings. Native race/AI recordings and their final screenshots are retained with the Page evidence. Original camera behavior, simulation, input handling, score rules and recovery timing are preserved.

This is local acceptance. GitHub fork creation, GitHub Actions and deployment have not executed: the connected account can write existing repositories, but the available GitHub MCP has no fork/create-repository method. Physical Android/iPhone behavior, physical-device frame rates and photographic concept fidelity remain separate work. A `[verify only]` commit keeps deployment gated while CI is obtained.
