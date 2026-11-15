const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),base=new URL(process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href);
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','flicker');
const sizes=[{width:844,height:390},{width:390,height:844},{width:320,height:740}];
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
const checks=[],pictures=[],videos=[],errors=[],occlusionFixture=[];
fs.mkdirSync(out,{recursive:true});

async function installProbe(page){
 await page.evaluate(()=>{
  const referenceDraw=drawPerspective;
  window.vehicleTerrainOcclusion=()=>{
   const pose=perspectivePose(),cp=Math.cos(pose.pitch),sp=Math.sin(pose.pitch);
   const points=playerCarMesh().flatMap(face=>[...face.vertices,face.vertices.reduce((sum,v)=>sum.map((n,i)=>n+v[i]/face.vertices.length),[0,0,0])]);
   const subtract=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
   const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
   const projection=points.map(point=>{
    const [dx,dy,dz]=subtract(point,pose.camera),forward=dx*pose.forward[0]+dz*pose.forward[1];
    const depth=forward*cp-dy*sp,right=dx*pose.right[0]+dz*pose.right[1],up=dy*cp+forward*sp;
    return{x:w/2+right*pose.focal/depth,y:pose.horizon-up*pose.focal/depth,depth};
   });
   const minX=Math.min(...projection.map(p=>p.x)),maxX=Math.max(...projection.map(p=>p.x));
   const minY=Math.min(...projection.map(p=>p.y)),maxY=Math.max(...projection.map(p=>p.y));
   const projectedBounds={minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY,
    inFront:projection.every(p=>p.depth>4),insideViewport:minX>=0&&minY>=0&&maxX<=w&&maxY<=h};
   const triangles=[];
   for(let index=0;index<roadMesh.length;index++){
    const face=roadMesh[index];if(!face.ground)continue;
    for(let k=1;k<face.vertices.length-1;k++){
     const [a,b,c]=[face.vertices[0],face.vertices[k],face.vertices[k+1]];
     triangles.push({index,a,edge1:subtract(b,a),edge2:subtract(c,a),
      min:a.map((v,i)=>Math.min(v,b[i],c[i])),max:a.map((v,i)=>Math.max(v,b[i],c[i]))});
    }
   }
   let blocked=0;const blockers=new Set();
   for(const point of points){
    const direction=subtract(point,pose.camera);let nearestHit=1,blocker=-1;
    const min=point.map((v,i)=>Math.min(v,pose.camera[i])),max=point.map((v,i)=>Math.max(v,pose.camera[i]));
    for(const {index,a,edge1,edge2,min:lower,max:upper} of triangles){
      // A segment cannot hit a triangle with a disjoint bounding box. All rays
      // and every potentially intersecting terrain triangle still execute.
      if(min[0]>upper[0]+1e-6||max[0]<lower[0]-1e-6||min[1]>upper[1]+1e-6||max[1]<lower[1]-1e-6||min[2]>upper[2]+1e-6||max[2]<lower[2]-1e-6)continue;
      const normal=cross(direction,edge2),determinant=dot(edge1,normal);if(Math.abs(determinant)<1e-8)continue;
      const inverse=1/determinant,offset=subtract(pose.camera,a),u=inverse*dot(offset,normal);if(u<0||u>1)continue;
      const q=cross(offset,edge1),v=inverse*dot(direction,q);if(v<0||u+v>1)continue;
      const distance=inverse*dot(edge2,q);if(distance>1e-6&&distance<nearestHit-1e-6){nearestHit=distance;blocker=index;}
    }
    if(blocker>=0){blocked++;blockers.add(blocker);}
   }
   return{rays:points.length,blocked,blockerFaces:[...blockers],projectedBounds,camera:pose.camera};
  };
  window.vehicleRegion=()=>{
   const original=playerCarMesh;
   drawPerspective();const actualImage=ctx.getImageData(0,0,w,h),actual=actualImage.data;
   try{playerCarMesh=()=>[];drawPerspective();}
   finally{playerCarMesh=original;}
   const blank=ctx.getImageData(0,0,w,h).data;
   let pixels=0,minX=w,minY=h,maxX=0,maxY=0,hash=2166136261;
   for(let i=0;i<actual.length;i+=4){
    if(Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])>20){
     const x=(i/4)%canvas.width/(canvas.width/w),y=Math.floor(i/4/canvas.width)/(canvas.height/h);
     pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    hash=Math.imul(hash^actual[i],16777619);hash=Math.imul(hash^actual[i+1],16777619);hash=Math.imul(hash^actual[i+2],16777619);
   }
   // Restore the exact sampled image without rendering the same pose again.
   ctx.putImageData(actualImage,0,0);
   const lowVisibility=pixels<=100||maxX-minX+1<=15||maxY-minY+1<=10;
   const terrainOcclusion=lowVisibility&&hazard.fall>0?vehicleTerrainOcclusion():null;
   if(terrainOcclusion&&terrainOcclusion.blocked>0&&terrainOcclusion.blocked<terrainOcclusion.rays){
    const currentRenderer=mountainRenderer,currentDepth=softwareDepthRenderer;
    const backend=currentRenderer?.snapshot?.().backend==='materials'?'materials':'software';
    let freshRenderer;
    try{
     // Fresh resources and the full player function independently establish
     // the exact same-pose car mask, including subpixel terrain silhouettes.
     mountainRenderer=backend==='materials'?createMountainRenderer():null;
     freshRenderer=mountainRenderer;softwareDepthRenderer=undefined;playerCarMesh=original;
     const playerFaces=playerCarMesh().length;
     referenceDraw();const expected=ctx.getImageData(0,0,w,h).data;
     const freshBackend=mountainRenderer?.snapshot?.().backend==='materials'?'materials':'software';
     if(freshBackend!==backend)throw new Error('Fresh terrain reference changed rendering backend');
     playerCarMesh=()=>[];referenceDraw();const expectedBlank=ctx.getImageData(0,0,w,h).data;
     let expectedPixels=0,missingPixels=0,extraPixels=0;
     for(let i=0;i<actual.length;i+=4){
      const present=Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])>20;
      const required=Math.abs(expected[i]-expectedBlank[i])+Math.abs(expected[i+1]-expectedBlank[i+1])+Math.abs(expected[i+2]-expectedBlank[i+2])>20;
      if(required)expectedPixels++;if(required&&!present)missingPixels++;if(present&&!required)extraPixels++;
     }
     terrainOcclusion.rasterReference={backend,playerFaces,expectedPixels,actualPixels:pixels,missingPixels,extraPixels,maskMismatches:missingPixels+extraPixels};
    }finally{
     mountainRenderer=currentRenderer;softwareDepthRenderer=currentDepth;playerCarMesh=original;ctx.putImageData(actualImage,0,0);
     freshRenderer?.surface.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
    }
   }
   return {pixels,width:maxX-minX+1,height:maxY-minY+1,hash:hash>>>0,angle:car.angle,terrainOcclusion,
    occludedCanvas:terrainOcclusion?canvas.toDataURL().split(',')[1]:undefined};
  };
 });
}
async function picture(page,name){
 await page.screenshot({path:path.join(out,name+'.png')});pictures.push(name+'.png');
 const png=await page.evaluate(()=>canvas.toDataURL().split(',')[1]);
 fs.writeFileSync(path.join(out,name+'-canvas.png'),Buffer.from(png,'base64'));pictures.push(name+'-canvas.png');
}
function visible(row,label,allowTerrainOcclusion=false){
 if(row.pixels>100&&row.width>15&&row.height>10)return 'visible';
 const proof=row.terrainOcclusion,bounds=proof?.projectedBounds;
 const fullyBlocked=!!proof&&proof.blocked===proof.rays;
 const reference=proof?.rasterReference;
 const partlyBlocked=proof?.blocked>0&&proof.blocked<proof.rays&&reference?.playerFaces>0&&reference.maskMismatches===0;
 assert(allowTerrainOcclusion&&row.snapshot?.hazard.fall>0&&proof?.rays>=50&&(fullyBlocked||partlyBlocked)&&
  bounds.inFront&&bounds.insideViewport&&bounds.width>15&&bounds.height>10,label+': '+JSON.stringify({...row,occludedCanvas:undefined}));
 return fullyBlocked?'terrain-occluded':'terrain-partly-occluded';
}
function saveOccludedCanvas(row,name){
 if(!row.occludedCanvas)return;
 fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(row.occludedCanvas,'base64'));pictures.push(name+'.png');
 delete row.occludedCanvas;
}
async function imageDifference(page,actual,expected){
 return page.evaluate(async([a,b])=>{
  const read=async source=>{const image=new Image();image.src=source;await image.decode();const surface=document.createElement('canvas');surface.width=image.width;surface.height=image.height;const context=surface.getContext('2d');context.drawImage(image,0,0);return{width:image.width,height:image.height,pixels:context.getImageData(0,0,image.width,image.height).data};};
  const first=await read(a),second=await read(b);
  if(first.width!==second.width||first.height!==second.height)return {sameSize:false};
  let total=0,changed=0;
  for(let i=0;i<first.pixels.length;i+=4){let max=0;for(let c=0;c<3;c++){const delta=Math.abs(first.pixels[i+c]-second.pixels[i+c]);total+=delta;max=Math.max(max,delta);}if(max>12)changed++;}
  const count=first.width*first.height;return{sameSize:true,mean:total/(count*3),fractionOver12:changed/count};
 },[actual,expected]);
}
function matchesFresh(difference){return difference.sameSize&&difference.mean<1&&difference.fractionOver12<.002;}

(async()=>{
 const browser=await chromium.launch(options);
 let failure;
 try{
  for(const viewport of sizes){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   for(const map of ['circuit','mountain','proving','city','offroad']){
    const url=new URL(base);url.searchParams.set('map',map);await page.goto(url.href);
    await installProbe(page);await page.locator('#start').click();await page.locator('[data-view=chase]').click();
    await page.keyboard.down('w');
    const frames=await page.evaluate(async()=>{
     const rows=[];
     for(let i=0;i<36;i++){
      await new Promise(requestAnimationFrame);
      rows.push({frame:i,...vehicleRegion(),snapshot:gameSnapshot()});
     }
     return rows;
    });
    await page.keyboard.up('w');
    const occluded=frames.filter(row=>{
     try{return visible(row,`${map}/${viewport.width}/frame-${row.frame}`,true)!=='visible';}
     catch(error){saveOccludedCanvas(row,`${map}-${viewport.width}-frame-${row.frame}-failure`);throw error;}
    });
    if(occluded.length)saveOccludedCanvas(occluded[0],`${map}-${viewport.width}-terrain-occluded`);
    for(const row of frames)delete row.occludedCanvas;
    let terrainRecovery;
    if(occluded.length){
     await page.waitForFunction(()=>gameSnapshot().hazard.fall===0);
     terrainRecovery=await page.evaluate(()=>({...vehicleRegion(),snapshot:gameSnapshot()}));
     visible(terrainRecovery,`${map}/${viewport.width}/after-terrain-occlusion-recovery`);
     await picture(page,`${map}-${viewport.width}-terrain-recovered`);
    }
    assert(frames.at(-1).snapshot.elapsed>frames[0].snapshot.elapsed);
    assert(frames.some(row=>row.snapshot.speed>5),'normal animation must actually drive');
    checks.push({id:`${map}/${viewport.width}/continuous-driving`,passed:true,frames,terrainOccludedFrames:occluded.length,
     terrainPartlyOccludedFrames:occluded.filter(row=>row.terrainOcclusion.blocked<row.terrainOcclusion.rays).length,terrainRecovery});
    console.log('PASS',map,viewport.width,'36 native animation frames;',occluded.length,'proved terrain-occluded frames; all other car frames visible');
   }
   for(const map of ['mountain','proving','city','offroad']){
    const url=new URL(base);url.searchParams.set('map',map);await page.goto(url.href);await installProbe(page);
    await page.locator('#start').click();await page.locator('[data-view=chase]').click();
    await page.locator('#pause').click();await page.evaluate(()=>$('#overlay').hidden=true);
    const name=`${map}-${viewport.width}`;
    const before=await page.evaluate(()=>vehicleRegion());visible(before,name+'/before');
    await picture(page,name+'-before');
    const immediate=await page.evaluate(()=>{
     const surface=mountainRenderer.surface,gl=surface.getContext('webgl'),extension=gl.getExtension('WEBGL_lose_context');
     if(!extension)throw new Error('WEBGL_lose_context required for this regression');
     window.flickerContext={surface,gl,extension,restored:0,lost:0};
     surface.addEventListener('webglcontextlost',()=>flickerContext.lost++);
     surface.addEventListener('webglcontextrestored',()=>flickerContext.restored++);
     extension.loseContext();
     const claimsSuccess=drawMountainPerspective(),region=vehicleRegion();
     return {lost:gl.isContextLost(),claimsSuccess,...region,canvas:canvas.toDataURL().split(',')[1]};
    });
    fs.writeFileSync(path.join(out,name+'-immediate-loss-canvas.png'),Buffer.from(immediate.canvas,'base64'));
    pictures.push(name+'-immediate-loss-canvas.png');delete immediate.canvas;
    await page.waitForFunction(()=>flickerContext.lost===1);
    const lost=await page.evaluate(()=>vehicleRegion());
    await picture(page,name+'-lost');
    fs.writeFileSync(path.join(out,name+'-loss.json'),JSON.stringify({before,immediate,lost},null,2)+'\n');
    assert.equal(immediate.lost,true);assert.equal(immediate.claimsSuccess,false,'lost WebGL must yield to software before event delivery');
    visible(immediate,name+'/immediate-loss');visible(lost,name+'/lost');
    const stable=await page.evaluate(async()=>{
     const rows=[];for(let i=0;i<6;i++){await new Promise(requestAnimationFrame);rows.push(vehicleRegion());}return rows;
    });
    assert(stable.every(row=>row.hash===stable[0].hash),'paused fallback frame must be pixel-stable');
    for(const view of ['first','top','chase']){
     const pose=await page.evaluate(()=>JSON.stringify(gameSnapshot()));
     await page.locator(`[data-view=${view}]`).click();
     const after=await page.evaluate(()=>gameSnapshot());assert.equal(after.view,view);
     const expected=JSON.parse(pose);expected.view=view;assert.deepEqual(after,expected);
    }
    const other=map==='mountain'?'proving':'mountain';
    await page.evaluate(other=>{selectMap(other);state='paused';$('#overlay').hidden=true;},other);
    const otherLost=await page.evaluate(()=>vehicleRegion());visible(otherLost,name+'/map-during-loss');
    await page.setViewportSize({width:viewport.height,height:viewport.width});
    await page.waitForFunction(size=>{
     const box=canvas.getBoundingClientRect();
     return innerWidth===size.width&&innerHeight===size.height&&Math.abs(w-box.width)<.5&&Math.abs(h-box.height)<.5;
    },{width:viewport.height,height:viewport.width});
    visible(await page.evaluate(()=>vehicleRegion()),name+'/resize-during-loss');
    await page.evaluate(()=>flickerContext.extension.restoreContext());
    await page.waitForFunction(()=>flickerContext.restored===1);
    const restored=await page.evaluate(()=>({success:drawMountainPerspective(),sameCanvas:mountainRenderer.surface===flickerContext.surface,glError:flickerContext.gl.getError(),...vehicleRegion(),png:canvas.toDataURL(),snapshot:gameSnapshot(),pose:perspectivePose()}));
    const restoredCanvas=restored.png;delete restored.png;
    assert(restored.success&&restored.sameCanvas);assert.equal(restored.glError,0);visible(restored,name+'/restored');
    const reference=await context.newPage();await reference.setViewportSize({width:viewport.height,height:viewport.width});
    const referenceUrl=new URL(base);referenceUrl.searchParams.set('map',other);await reference.goto(referenceUrl.href);await installProbe(reference);
    const expected=await reference.evaluate(()=>{state='paused';$('#overlay').hidden=true;selectView('chase');const region=vehicleRegion();return{region,png:canvas.toDataURL(),snapshot:gameSnapshot(),pose:perspectivePose()};});
    assert.deepEqual(restored.snapshot,expected.snapshot);assert.deepEqual(restored.pose,expected.pose);
    const comparison=await imageDifference(reference,restoredCanvas,expected.png);
    assert(matchesFresh(comparison),'restored current-map pixels differ from a fresh renderer: '+JSON.stringify(comparison));
    let wrongMapControl;
    if(map==='mountain'){
     const wrong=await reference.evaluate(map=>{selectMap(map);state='paused';$('#overlay').hidden=true;drawPerspective();return canvas.toDataURL();},map);
     wrongMapControl=await imageDifference(reference,restoredCanvas,wrong);
     assert(!matchesFresh(wrongMapControl),'fresh-frame comparison must reject stale pixels from the wrong map');
    }
    await reference.close();
    await picture(page,name+'-restored');
    const midComposite=await page.evaluate(()=>{
     const original=ctx.drawImage;let injected=false;
     try{
      ctx.drawImage=function(surface,...args){if(surface===flickerContext.surface&&!injected){injected=true;flickerContext.extension.loseContext();}return original.call(this,surface,...args);};
      return{claimsSuccess:drawMountainPerspective(),lost:flickerContext.gl.isContextLost()};
     }finally{ctx.drawImage=original;}
    });
    assert(midComposite.lost);assert.equal(midComposite.claimsSuccess,false,'loss during compositing must yield to software');
    await page.waitForFunction(()=>flickerContext.lost===2);
    visible(await page.evaluate(()=>vehicleRegion()),name+'/second-loss');
    await page.evaluate(()=>flickerContext.extension.restoreContext());await page.waitForFunction(()=>flickerContext.restored===2);
    const second=await page.evaluate(()=>({...vehicleRegion(),png:canvas.toDataURL()}));visible(second,name+'/second-restore');
    const secondComparison=await imageDifference(page,second.png,expected.png);assert(matchesFresh(secondComparison),JSON.stringify(secondComparison));
    assert.equal(await page.evaluate(()=>mountainRenderer.surface===flickerContext.surface),true);
    checks.push({id:name+'/loss-restore-map-resize',passed:true,before,immediate,lost,restored,comparison,secondComparison,wrongMapControl,midComposite,pausedPixelStable:true,repeatedLosses:2});
    await page.setViewportSize(viewport);
    console.log('PASS',name,'pre-event loss, software frames, camera/map/resize, two restores');
   }
   await context.close();
  }
  for(const backend of['webgl','software']){
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
   await context.addInitScript(backend=>{
    window.requestAnimationFrame=()=>0;
    if(backend==='software'){
     const original=HTMLCanvasElement.prototype.getContext;
     // Exact paired-pixel fixtures need a stable 2D readback path from creation.
     // Native-animation coverage above keeps the browser's default Canvas path.
     HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(/webgl/i.test(type))return null;
      return type==='2d'?original.call(this,type,{...(args[0]||{}),willReadFrequently:true}):original.call(this,type,...args);
     };
    }
   },backend);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   const url=new URL(base);url.searchParams.set('map','mountain');await page.goto(url.href);await installProbe(page);
   const hidden=await page.evaluate(()=>{
    start();selectView('chase');
    Object.assign(car,{x:931.0648623686869,y:2922.500716333764,z:36.73100737853362,speed:23.111605559709428});
    hazard={kind:'fall',impact:0,cooldown:0,fall:.7742000000000001,dust:.8001976027720703};elapsed=4.2330999999999985;
    for(let i=0;i<4;i++)vehicleRegion();
    return{...vehicleRegion(),snapshot:gameSnapshot(),backend:mountainRenderer?'webgl':'software'};
   });
   assert.equal(hidden.backend,backend);assert(hidden.pixels<=100,backend+': original deep-fall pose must remain below the existing visibility threshold');
   assert.equal(visible(hidden,backend+'/deep-fall-fixture',true),'terrain-occluded');
   saveOccludedCanvas(hidden,backend+'-deep-fall-fixture');
   const recovered=await page.evaluate(()=>{
    const before=elapsed;let steps=0;while(hazard.fall>0&&steps<100){update(.02);steps++;}
    return{...vehicleRegion(),snapshot:gameSnapshot(),steps,penalty:elapsed-before-steps*.02};
   });
   assert.equal(recovered.snapshot.hazard.fall,0);assert(Math.abs(recovered.penalty-5)<1e-6,'actual automatic recovery charges exactly once');
   visible(recovered,backend+'/deep-fall-fixture-recovered');await picture(page,backend+'-deep-fall-recovered');
   const partialFixtures=[];let subpixelFixture;
   for(const fixture of[
    {viewport:{width:390,height:844},car:{x:926.4300431650898,y:2918.2850743712397,z:37.65762521696776,speed:26.771953545772234,angle:-1.4838795383817158},fall:.7043000000000004,dust:.794418374795088,elapsed:4.4497999999999935},
    {viewport:{width:844,height:390},car:{x:926.1842539668844,y:2918.042745407284,z:37.67043698252949,speed:26.532102212049033,angle:-1.4838795383817156},fall:.7110000000000002,dust:.7888803593304633,elapsed:4.466499999999994}
   ]){
   await page.setViewportSize(fixture.viewport);
   await page.waitForFunction(size=>{
    const box=canvas.getBoundingClientRect();return innerWidth===size.width&&innerHeight===size.height&&Math.abs(w-box.width)<.5&&Math.abs(h-box.height)<.5;
   },fixture.viewport,{polling:20});
   const partial=await page.evaluate(fixture=>{
    selectMap('mountain');start();selectView('chase');
    Object.assign(car,fixture.car);
    hazard={kind:'fall',impact:0,cooldown:0,fall:fixture.fall,dust:fixture.dust};elapsed=fixture.elapsed;
    for(let i=0;i<4;i++)vehicleRegion();
    return{...vehicleRegion(),snapshot:gameSnapshot()};
   },fixture);
   assert(partial.pixels>0&&partial.pixels<=100,backend+': exact partial-fall pose must exercise the geometric visibility path');
   assert.equal(visible(partial,backend+'/partial-fall-fixture',true),'terrain-partly-occluded');
   saveOccludedCanvas(partial,backend+'-partial-fall-'+fixture.viewport.width);
   const partialNegative=await page.evaluate(()=>{
    const draw=drawPerspective,mesh=playerCarMesh;
    try{
     drawPerspective=()=>{try{playerCarMesh=()=>[];return draw();}finally{playerCarMesh=mesh;}};
     for(let i=0;i<4;i++)vehicleRegion();
     return{...vehicleRegion(),snapshot:gameSnapshot()};
    }finally{drawPerspective=draw;playerCarMesh=mesh;}
   });
   delete partialNegative.occludedCanvas;
   assert.deepEqual(partialNegative.snapshot,partial.snapshot,'same-pose negative control must preserve actual gameplay');
   assert.equal(partialNegative.pixels,0,backend+': the whole player mesh must really be absent');
   assert(partialNegative.terrainOcclusion.rasterReference.expectedPixels>0);
   assert(partialNegative.terrainOcclusion.rasterReference.missingPixels>0);
   assert.throws(()=>visible(partialNegative,backend+'/partial-fall-missing-car',true),assert.AssertionError);
   if(fixture.viewport.width===390){
    const region=await page.evaluate(()=>{for(let i=0;i<5;i++)update(.002);return{...vehicleRegion(),snapshot:gameSnapshot()};});
    assert(region.pixels<=100);
    assert.equal(visible(region,backend+'/subpixel-fall-fixture',true),'terrain-partly-occluded');
    assert.equal(region.terrainOcclusion.rasterReference.maskMismatches,0);
    saveOccludedCanvas(region,backend+'-subpixel-fall');
    subpixelFixture={passed:true,region};
   }
   const partialRecovered=await page.evaluate(()=>{
    const before=elapsed;let steps=0;while(hazard.fall>0&&steps<100){update(.02);steps++;}
    return{...vehicleRegion(),snapshot:gameSnapshot(),steps,penalty:elapsed-before-steps*.02};
   });
   assert.equal(partialRecovered.snapshot.hazard.fall,0);assert(Math.abs(partialRecovered.penalty-5)<1e-6);
   visible(partialRecovered,backend+'/partial-fall-recovered');await picture(page,backend+'-partial-fall-recovered-'+fixture.viewport.width);
   if(fixture.viewport.width===390)subpixelFixture.recovered=partialRecovered;
   partialFixtures.push({viewport:fixture.viewport,passed:true,region:partial,recovered:partialRecovered,negativeControl:{...partialNegative,rejected:true}});
   }
   await page.setViewportSize({width:390,height:844});
   await page.waitForFunction(()=>Math.abs(w-canvas.getBoundingClientRect().width)<.5&&Math.abs(h-canvas.getBoundingClientRect().height)<.5,null,{polling:20});
   const negative=await page.evaluate(()=>{
    selectMap('circuit');start();selectView('chase');hazard.fall=.001;
    const draw=drawPerspective,mesh=playerCarMesh;
    try{
     drawPerspective=()=>{
      try{playerCarMesh=()=>[];return draw();}
      finally{playerCarMesh=mesh;}
     };
     for(let i=0;i<4;i++)vehicleRegion();
     return{...vehicleRegion(),snapshot:gameSnapshot()};
    }finally{drawPerspective=draw;playerCarMesh=mesh;}
   });
   delete negative.occludedCanvas;
   assert.equal(negative.pixels,0,backend+': missing-car negative control must contain no player pixels');assert(negative.terrainOcclusion.rays>=50);
   assert(negative.terrainOcclusion.blocked<negative.terrainOcclusion.rays,'open road must not prove full terrain occlusion');
   assert.throws(()=>visible(negative,backend+'/missing-car-negative-control',true),assert.AssertionError);
   occlusionFixture.push({backend,passed:true,hidden,recovered,negativeControl:{...negative,rejected:true},
    partialFixtures,subpixelFixture});
   console.log('PASS',backend,'exact full/partial terrain occlusion, actual recoveries, open-road and same-pose missing-car negative controls');
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){failure=error;console.error(error);}
 finally{
  const summary={passed:!failure,browser:browser.version(),target:base.href,checks,pictures,videos,occlusionFixture,
   temporalFrames:checks.reduce((n,row)=>n+(row.frames?.length||0),0),consoleErrors:errors,error:failure?.message,
   scope:'Native animation and real keyboard drive all five maps. Context loss uses the official WebGL extension. Paused fixtures compare actual car-only pixels and ground-ray projections. Whole player meshes are deliberately removed for differential measurements and negative controls; track geometry and physics stay intact. Physical phones are not tested.'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(summary,null,2)+'\n');
  await browser.close();
 }
 if(failure)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
