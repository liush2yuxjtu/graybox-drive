/* Graybox Drive GT-01. Original procedural visual asset. Units match DriveArt.
 * Local axes: +X forward, +Y up, +Z right; origin at road centre.
 * No dependencies. Browser: GrayboxGT. Node: require('./graybox-gt.js').
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 const materials={paint:{color:'#d92940',metalness:.72,roughness:.25,clearcoat:1},glass:{color:'#111d29',metalness:.25,roughness:.12},carbon:{color:'#1a1d22',metalness:.25,roughness:.6},rubber:{color:'#16171b',metalness:0,roughness:.93},alloy:{color:'#707782',metalness:.88,roughness:.28},accent:{color:'#52d8f4',metalness:.25,roughness:.35},headlight:{color:'#d8f7ff',emissive:'#b7eaff',emissiveIntensity:1.5},taillight:{color:'#ff233c',emissive:'#ff1733',emissiveIntensity:1.2}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const mix=(a,b,t)=>a+(b-a)*t;
 function createFaces(options={}){
  const lod=clamp(Math.round(options.lod||0),0,2), economy=options.economy===true, n=economy?12:[80,40,20][lod], radial=economy?8:[32,20,12][lod], across=economy?6:16;
  const faces=[],width=clamp(options.width||1, .92,1.12),ride=clamp(options.rideHeight??.72,.4,1.2)-.72;
  const add=(vertices,material,part='body')=>faces.push({vertices,color:material==='paint'?(options.color||materials.paint.color):materials[material].color,material,part});
  const box=(x,y,z,l,h,w,mat,part='body')=>{
   const p=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*l/2,y+b*h/2,z+c*w/2]);
   for(const q of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])add(q.map(i=>p[i]),mat,part);
  };
  const halfWidth=x=>10.6+1.9*Math.exp(-(((x-12)/6)**2))+2.1*Math.exp(-(((x+13)/6)**2))-1.9*(Math.abs(x)/22)**8;
  const height=(x,t)=>{
   const middle=10.2-4.1*(clamp((x-9)/13,0,1)**1.6)+.6*Math.exp(-(((x+15)/8)**2));
   const arch=2.8*Math.exp(-(((x-12)/6)**2))+2.4*Math.exp(-(((x+13)/6)**2));
   return middle + arch*Math.sin(Math.abs(t)*Math.PI/2)**3-.5*Math.abs(t)**8;
  };
  const opening=x=>Math.max(...[12,-13].map(c=>Math.abs(x-c)<5.7?5.5+Math.sqrt(5.7**2-(x-c)**2):2.0),2);
  // Continuous loft, not stacked cuboids. True open wheel arches on both sides.
  for(let i=0;i<n;i++){
   const a=-22+44*i/n,b=-22+44*(i+1)/n;
   for(let k=0;k<across;k++){
    const u=-1+k*2/across,v=u+2/across;
    add([[a,height(a,u),u*halfWidth(a)],[b,height(b,u),u*halfWidth(b)],[b,height(b,v),v*halfWidth(b)],[a,height(a,v),v*halfWidth(a)]],'paint');
   }
   for(const s of [-1,1]){
    const aTop=Math.max(height(a,1),opening(a)+.3),bTop=Math.max(height(b,1),opening(b)+.3);
    add([[a,opening(a),s*halfWidth(a)],[b,opening(b),s*halfWidth(b)],[b,bTop,s*halfWidth(b)],[a,aTop,s*halfWidth(a)]],'paint');
    add([[a,opening(a),s*halfWidth(a)],[a,opening(a),s*(halfWidth(a)-.45)],[b,opening(b),s*(halfWidth(b)-.45)],[b,opening(b),s*halfWidth(b)]],'carbon');
   }
   if(a>8||b<-10)add([[a,height(a,-.055)+.035,-.055*halfWidth(a)],[b,height(b,-.055)+.035,-.055*halfWidth(b)],[b,height(b,.055)+.035,.055*halfWidth(b)],[a,height(a,.055)+.035,.055*halfWidth(a)]],'accent');
  }
  for(const end of [-22,22]){
   const w=halfWidth(end),top=height(end,0);
   add([[end,2,-w],[end,2,w],[end,top,w],[end,top,-w]],'paint');
  }
  // Canopy: curved cross sections with roof, separate side glass and pillars.
  const stations=[[-10,10.6,8.3],[-8,12.5,7.7],[-5,15.4,6.5],[-2,16,6.35],[1.5,15.5,6.45],[4,14,7.1],[8,10.8,8.5]];
  for(let i=0;i<stations.length-1;i++){
   const [x,h,w]=stations[i],[xx,hh,ww]=stations[i+1];
   for(let j=0;j<12;j++){
    const a=-1+j/6,b=a+1/6;
    const p=(f,y,z,t)=>[f,y-2.5*Math.abs(t)**2,z*t];
    add([p(x,h,w,a),p(xx,hh,ww,a),p(xx,hh,ww,b),p(x,h,w,b)],i===2||i===3?'paint':'glass','canopy');
   }
   for(const s of [-1,1])add([[x,10.5,s*8.5],[xx,10.5,s*8.5],[xx,hh-2.5,s*ww],[x,h-2.5,s*w]],'glass','canopy');
   if(i===2||i===3)add([[x,h+.03,-.6],[xx,hh+.03,-.6],[xx,hh+.03,.6],[x,h+.03,.6]],'accent','canopy');
  }
  // Vents, front splitter, side skirts, mirrors, diffuser and narrow lamps.
  box(22.15,3.8,0,.6,3.1,15.5,'carbon');box(21.9,1.8,0,2,.45,23.5,'carbon');
  box(-21.9,4.1,0,.8,4.8,19.4,'carbon');box(-22.4,1.7,0,1.1,.4,24,'carbon');
  for(const z of [-8.5,-4.3,0,4.3,8.5])box(-22.5,2.6,z,2.6,3,.22,'carbon');
  box(-22.44,8.9,0,.13,.45,20.3,'taillight');
  for(const s of [-1,1]){
   add([[22.37,6.2,s*6.5],[21.7,7,s*10.2],[21.7,7.3,s*10.2],[22.37,6.5,s*6.5]],'headlight');
   box(0,2.1,s*11.9,25,.55,1.35,'carbon');
   add([[-8,5,s*12],[-4,4,s*12],[-1,10,s*11.1],[-5,10.7,s*11.4]],'carbon');
   box(5.1,12.1,s*9.2,.5,.45,3.1,'carbon','mirror');
   box(5.1,12.7,s*10.8,2.8,.9,1.7,'carbon','mirror');
   for(let i=0;i<5;i++)box(-16+i*.85,12,s*8.7,.28,.1,2.6,'carbon');
  }
  if(options.wing!==false){
   for(const s of [-1,1])box(-17.9,14,s*8.8,1,6.4,.5,'carbon','wing');
   box(-18.9,17.2,0,4.4,.55,28,'carbon','wing');
   for(const s of [-1,1])box(-18.9,17.6,s*14,4.9,1.7,.27,'carbon','wing');
  }
  // Offset visual body only. Tyres retain ground contact.
  const transformed=new WeakSet();
  for(const f of faces)for(const v of f.vertices){if(transformed.has(v))continue;transformed.add(v);v[1]+=ride;v[2]*=width;}
  for(const x of [-13,12])for(const s of [-1,1]){
   const z=s*12.25*width, part=`wheel-${x>0?'front':'rear'}-${s<0?'left':'right'}`;
   const at=(a,r,d)=>[x+Math.cos(a)*r,5.5+Math.sin(a)*r,z+s*d];
   for(let i=0;i<radial;i++){
    const a=i/radial*TAU,b=(i+1)/radial*TAU;
    add([at(a,5.25,-1.25),at(b,5.25,-1.25),at(b,5.25,1.25),at(a,5.25,1.25)],'rubber',part);
    add([at(a,5.25,1.25),at(b,5.25,1.25),at(b,3.8,1.45),at(a,3.8,1.45)],'rubber',part);
    add([at(a,3.8,1.46),at(b,3.8,1.46),at(b,3.4,1.48),at(a,3.4,1.48)],'alloy',part);
    add([at(a,3.1,1.1),at(b,3.1,1.1),[x,5.5,z+s*1.1]],'alloy',part);
   }
   for(let i=0;i<5;i++){
    const a=i/5*TAU;
    add([at(a,.6,1.52),at(a-.08,3.55,1.52),at(a+.12,3.55,1.52),at(a+.4,.6,1.52)],'carbon',part);
   }
   box(x,5.5,z+s*1.55,.9,.9,.3,'alloy',part);
   box(x+2,5.8,z+s*.95,1,3,.35,'paint',part);
  }
  return faces;
 }
 function carMesh(x=0,z=0,angle=0,colors,base=0,options={}){
  const c=Math.cos(angle),s=Math.sin(angle);
  return createFaces({...options,color:colors?.[0]||options.color}).map(f=>({...f,vertices:f.vertices.map(([a,b,d])=>[x+a*c-d*s,base+b,z+a*s+d*c])}));
 }
 const metadata={name:'Graybox GT-01',version:1,axes:'+X forward, +Y up, +Z right',units:'existing Graybox Drive world units',wheelRadius:5.25,wheelbase:25,visualLength:45.8,collision:'Use existing game collision; visual geometry does not change physics.',scope:'Standalone visual candidate, not deployed.'};
 const api={createFaces,carMesh,materials,metadata};
 root.GrayboxGT=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);

// Bridge the procedural asset to the game's existing visual-only face interface.
const DriveCar = (() => {
 const templates = new Map();
 const materialNames = {alloy:'metal',carbon:'rubber',accent:'paint',headlight:'lamp',taillight:'lamp'};
 function template(colors, player, economy) {
  const key = colors[0] + '/' + player + '/' + economy;
  if (templates.has(key)) return templates.get(key);
  const faces = GrayboxGT.createFaces({color:colors[0],lod:player?1:2,economy});
  const sums = new Map();
  const keyAt = (face,point) => face.material + '/' + face.part + '/' + point.map(n=>n.toFixed(4)).join('/');
  for (const face of faces) {
   const [a,b,c] = face.vertices, u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
   let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
   n=n.map(v=>v/len);face.normal=n;
   if (face.part==='body'&&face.material==='paint'||face.part==='canopy') for (const p of face.vertices) {
    const key=keyAt(face,p), sum=sums.get(key)||[0,0,0];for(let i=0;i<3;i++)sum[i]+=n[i];sums.set(key,sum);
   }
  }
  for(const face of faces){
   face.normals=face.vertices.map(p=>{const n=sums.get(keyAt(face,p))||face.normal,len=Math.hypot(...n)||1;return n.map(v=>v/len)});
   face.material=materialNames[face.material]||face.material;
   delete face.normal;
  }
  templates.set(key,faces);return faces;
 }
 function mesh(x,z,angle,colors,base=0,player=false){
  const c=Math.cos(angle),s=Math.sin(angle),rotate=([a,b,d])=>[a*c-d*s,b,a*s+d*c];
  const renderer=typeof mountainRenderer!=='undefined'?mountainRenderer:null;
  const status=renderer?.snapshot?.();
  const economy=!renderer||status?.softwareGpu===true||status?.backend==='software';
  return template(colors,player,economy).map(face=>({...face,vertices:face.vertices.map(p=>{const v=rotate(p);return[x+v[0],base+v[1],z+v[2]]}),normals:face.normals.map(rotate)}));
 }
 return {mesh};
})();
