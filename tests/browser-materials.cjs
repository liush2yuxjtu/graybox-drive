const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
assert(process.env.DRIVE_URL, 'Use tests/verify.py to serve the real game assets');
const url = process.env.DRIVE_URL, out = path.resolve(process.env.DRIVE_VERIFY_DIR || 'verification/latest', 'materials');
const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] };
if (process.env.DRIVE_CHROMIUM_PATH) options.executablePath = process.env.DRIVE_CHROMIUM_PATH;
const scenes = [], pictures = [], errors = [];
fs.mkdirSync(out, { recursive: true });

(async () => {
 const browser = await chromium.launch(options);let result, failure;
 try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const page = await context.newPage();page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);await page.waitForLoadState('networkidle');
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
   await page.setViewportSize(viewport);
   for (const map of ['circuit', 'mountain', 'proving', 'city', 'offroad']) for (const view of ['first', 'chase']) {
    const scene = await page.evaluate(({ map, view }) => {
     selectMap(map);start();selectView(view);
     const before = gameSnapshot();draw();const after = gameSnapshot();
     return { before, after, renderer: mountainRenderer?.snapshot?.() };
    }, { map, view });
    assert.deepEqual(scene.after, scene.before, 'Material drawing must not advance or rewrite the race');
    assert.equal(scene.renderer?.backend, 'materials', JSON.stringify(scene.renderer));
    assert.equal(scene.renderer.failure, null);assert(scene.renderer.draws > 0);
    const name = `${map}-${view}-${viewport.width}.png`;
    await page.screenshot({ path: path.join(out, name) });pictures.push(name);
    scenes.push({ map, view, viewport, renderer: scene.renderer });
    console.log('PASS material scene', map, view, viewport.width);
   }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  const negativeControl = await page.evaluate(() => {
   selectMap('circuit');start();selectView('chase');drawPerspective();
   const actual = ctx.getImageData(0, 0, w, h).data, mesh = playerCarMesh;
   try {
    playerCarMesh = () => [];drawPerspective();const blank = ctx.getImageData(0, 0, w, h).data;
    let pixels = 0;for (let i = 0; i < actual.length; i += 4) if (Math.abs(actual[i] - blank[i]) + Math.abs(actual[i + 1] - blank[i + 1]) + Math.abs(actual[i + 2] - blank[i + 2]) > 20) pixels++;
    return { pixels };
   } finally { playerCarMesh = mesh;draw(); }
  });
  assert(negativeControl.pixels > 100, 'Removing the entire car must remove visible car pixels');
  const beforeLoss = await page.evaluate(() => gameSnapshot());
  await page.evaluate(() => {
   window.materialLoss = mountainRenderer.surface.getContext('webgl').getExtension('WEBGL_lose_context');
   if (!materialLoss) throw Error('Context-loss extension required for renderer lifecycle acceptance');
   materialLoss.loseContext();
  });
  await page.waitForFunction(() => mountainRenderer.surface.getContext('webgl').isContextLost());
  await page.evaluate(() => draw());
  assert.deepEqual(await page.evaluate(() => gameSnapshot()), beforeLoss, 'GPU loss must preserve the current race');
  await page.screenshot({ path: path.join(out, 'context-loss-fallback.png') });pictures.push('context-loss-fallback.png');
  await page.evaluate(() => materialLoss.restoreContext());
  await page.waitForFunction(() => !mountainRenderer.surface.getContext('webgl').isContextLost());
  await page.evaluate(() => draw());
  const restored = await page.evaluate(() => mountainRenderer.snapshot());
  assert.equal(restored.backend, 'materials');assert.equal(restored.failure, null);
  assert.deepEqual(await page.evaluate(() => gameSnapshot()), beforeLoss, 'GPU restoration must preserve the race');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(out, 'context-restored.png') });pictures.push('context-restored.png');
  result = { passed: true, browser: browser.version(), source: url, scenes, pictures, negativeControl,
   contextRestored: true, fallbackPreservesGame: true, errors,
   scope: 'Actual WebGL material and shadow shaders, all five maps, two cameras, landscape and portrait. Frozen scene inputs; the full suite separately requires ordinary native-animation driving and a legal three-lap finish. No physical phone or photographic parity claim.' };
  await context.close();
 } catch (error) { failure = error;result = { passed: false, error: error.message, scenes, pictures, errors }; }
 finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');await browser.close(); }
 if (failure) throw failure;
})().catch(error => { console.error(error);process.exitCode = 1; });
