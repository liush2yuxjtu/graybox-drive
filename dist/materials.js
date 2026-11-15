'use strict';

const DriveMaterials = (() => {
 const surfaces = {
  paint: [.24, .7, 0, 0], glass: [.12, .78, 0, 0], metal: [.25, .82, 0, 0],
  rubber: [.93, .03, 0, 4], asphalt: [.64, .08, 0, 1], concrete: [.86, .03, 0, 2],
  facade: [.36, .44, 0, 3], stone: [.94, 0, 0, 2], soil: [.98, 0, 0, 4],
  lamp: [.3, .1, 1.6, 0], marking: [.65, .03, 0, 0]
 };
 const asphalt = new Set(['#292b39', '#505c57', '#4d605a', '#4b5a55', '#46534f']);
 const facade = new Set(['#555063', '#706174', '#9c8495', '#8f8092', '#4e495e', '#706175']);
 const lights = new Set(['#ffcfbf', '#fa5b62', '#ff9e93', '#fff3d3', '#fff5e6', '#c6ebff', '#a2f0ff', '#38c8f1']);

 function surfaceFor(face) {
  if (face.material && surfaces[face.material]) return surfaces[face.material];
  if (lights.has(face.color)) return surfaces.lamp;
  if (facade.has(face.color)) return surfaces.facade;
  if (face.ground) return asphalt.has(face.color) ? surfaces.asphalt : surfaces.concrete;
  return surfaces.concrete;
 }

 function vertices(faces) {
  const data = [];
  for (const face of faces) {
   const points = face.vertices, color = face.color.slice(1);
   const rgb = [0, 2, 4].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
   const a = points[0], b = points[1], c = points[2];
   const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
   let normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
   const length = Math.hypot(...normal);
   if (length < .000001) continue;
   normal = normal.map(value => value / length);
   if (face.ground && normal[1] < 0) normal = normal.map(value => -value);
   const surface = surfaceFor(face);
   for (let k = 1; k < points.length - 1; k++) for (const index of [0, k, k + 1]) {
    data.push(...points[index], ...rgb, ...(face.normals?.[index] || normal), ...surface);
   }
  }
  return new Float32Array(data);
 }

 function createRenderer(surface, gl) {
  let resources, failure = null, draws = 0;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  // Software rasterizers need a bounded render target so short collision states
  // remain observable between frames. Physics and input still run unchanged.
  const softwareGpu = /swiftshader|llvmpipe|lavapipe|software/i.test(rendererName || '');
  const renderLimit = softwareGpu ? 256 : Infinity;
  const light = [.48, .64, -.6], right = [.780869, 0, .624695], up = [-.399805, .768375, .499756];
  const shadowSize = softwareGpu ? 128 : 768, shadowRange = 650;
  const vertex = `attribute vec3 aPosition;attribute vec3 aColor;attribute vec3 aNormal;attribute vec4 aSurface;
   uniform vec3 uCamera;uniform vec2 uForward;uniform vec2 uRight;uniform vec2 uPitch;uniform vec3 uProjection;
   uniform vec3 uLightCenter;uniform vec3 uLightRight;uniform vec3 uLightUp;uniform vec3 uLight;uniform float uShadowRange;
   varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vSurface;varying vec3 vShadow;varying float vDepth;
   void main(){vec3 d=aPosition-uCamera;float f=dot(d.xz,uForward);float r=dot(d.xz,uRight);
    float height=d.y*uPitch.x+f*uPitch.y;float depth=f*uPitch.x-d.y*uPitch.y;
    gl_Position=vec4(r*uProjection.x,height*uProjection.y+depth*uProjection.z,1.00267*depth-8.01068,depth);
    vec3 s=aPosition-uLightCenter;vShadow=vec3(dot(s,uLightRight),dot(s,uLightUp),dot(s,-uLight))/uShadowRange*.5+.5;
    vColor=aColor;vNormal=aNormal;vWorld=aPosition;vSurface=aSurface;vDepth=depth;}`;
  const fragment = `precision highp float;
   uniform vec3 uCamera;uniform vec3 uLight;uniform sampler2D uShadow;uniform sampler2D uSky;uniform float uHasSky;
   varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vSurface;varying vec3 vShadow;varying float vDepth;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
   vec3 environment(vec3 d,float rough){
    vec3 col=mix(vec3(.17,.15,.24),vec3(.59,.51,.67),smoothstep(-.1,.7,d.y));
    col=mix(col,vec3(1.,.71,.49),pow(max(0.,dot(d,uLight)),24.));
    vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,clamp(.5+d.y*.46,.02,.98));
    vec3 sky=texture2D(uSky,uv).rgb;
    col=mix(col,mix(sky,vec3(.55,.43,.52),rough*.5),uHasSky*.7);
    float tower=step(d.y,.035+hash(vec2(floor(uv.x*72.),1.))*.16)*step(-.3,d.y);
    return mix(col,vec3(.12,.12,.18),tower*.67);
   }
   float shadow(){
    if(vShadow.x<0.||vShadow.x>1.||vShadow.y<0.||vShadow.y>1.||vShadow.z>1.)return 1.;
    float sum=0.;float bias=.0014+.001*(1.-abs(dot(normalize(vNormal),uLight)));
    for(int x=0;x<2;x++)for(int y=0;y<2;y++){
     vec4 rgba=texture2D(uShadow,vShadow.xy+(vec2(float(x),float(y))-.5)/${shadowSize}.);
     float depth=dot(rgba,vec4(1.,1./255.,1./65025.,1./16581375.));
     sum+=step(vShadow.z-bias,depth);
    }return .24+sum*.19;
   }
   void main(){
    vec3 n=normalize(vNormal),view=normalize(uCamera-vWorld);if(dot(n,view)<0.)n=-n;
    float rough=vSurface.x,metal=vSurface.y,kind=vSurface.w;vec3 base=pow(vColor,vec3(2.2));
    if(kind>.5&&kind<1.5){
     float grain=noise(vWorld.xz*2.8),patch=noise(vWorld.xz*.018);
     base*=.79+grain*.32;rough=clamp(rough+(patch-.5)*.48,.22,.88);
     n=normalize(n+vec3((grain-.5)*.055,0.,(noise(vWorld.zx*2.3)-.5)*.055));
    }else if(kind>1.5&&kind<2.5){
     float grain=noise(vWorld.xz*.8+vWorld.yz*.15);base*=.88+grain*.22;
     vec2 panel=fract(vec2(vWorld.x+vWorld.z,vWorld.y)*.025);
     base*=.8+.2*smoothstep(.006,.02,min(panel.x,panel.y));
    }else if(kind>2.5&&kind<3.5){
     vec2 tile=vec2(vWorld.x+vWorld.z,vWorld.y)*vec2(.09,.12),cell=floor(tile),f=fract(tile);
     float window=step(.16,f.x)*step(f.x,.87)*step(.14,f.y)*step(f.y,.84);
     base*=mix(.55,1.17,window);rough=mix(.7,.23,window);
     base+=vec3(.27,.16,.065)*window*step(.86,hash(cell));
    }else if(kind>3.5){base*=.86+noise(vWorld.xz*2.)*.2;}
    vec3 l=normalize(uLight),halfway=normalize(l+view);float nl=max(.0,dot(n,l)),nv=max(.04,dot(n,view)),nh=max(.0,dot(n,halfway));
    float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;float distribution=a2/max(.0001,3.14159265*d*d);
    float k=(rough+1.)*(rough+1.)*.125;float geometry=(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));
    vec3 f0=mix(vec3(.045),base,metal),fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(halfway,view)),5.);
    vec3 specular=distribution*geometry*fresnel/max(.01,4.*nl*nv);
    vec3 diffuse=(1.-fresnel)*(1.-metal)*base/3.14159265;
    float visibility=shadow();vec3 direct=(diffuse+specular)*vec3(3.8,2.55,1.9)*nl*visibility;
    vec3 reflection=environment(reflect(-view,n),rough),ambient=base*mix(vec3(.22,.19,.3),vec3(.48,.48,.62),n.y*.5+.5)*(1.-metal*.72);
    vec3 envF=f0+(max(vec3(1.-rough),f0)-f0)*pow(1.-nv,5.);
    vec3 color=direct+ambient+reflection*envF*(1.-rough*.57)*.9+base*vSurface.z;
    float fog=smoothstep(450.,2900.,vDepth)*.72;color=mix(color,vec3(.38,.32,.43),fog);
    color=color/(color+vec3(.7));color=pow(color,vec3(1./2.2));gl_FragColor=vec4(color,1.);
   }`;
  const depthVertex = `attribute vec3 aPosition;uniform vec3 uLightCenter;uniform vec3 uLightRight;uniform vec3 uLightUp;uniform vec3 uLight;uniform float uShadowRange;
   void main(){vec3 p=aPosition-uLightCenter;gl_Position=vec4(vec3(dot(p,uLightRight),dot(p,uLightUp),dot(p,-uLight))/uShadowRange,1.);}`;
  const depthFragment = `precision highp float;void main(){vec4 enc=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));enc-=enc.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=enc;}`;

  function program(vs, fs) {
   const shaders = [ [gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs] ].map(([type, source]) => {
    const shader = gl.createShader(type);gl.shaderSource(shader, source);gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
   });
   const result = gl.createProgram();for (const shader of shaders) gl.attachShader(result, shader);
   gl.linkProgram(result);for (const shader of shaders) gl.deleteShader(shader);
   if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(result));
   const names = ['uCamera', 'uForward', 'uRight', 'uPitch', 'uProjection', 'uLightCenter', 'uLightRight', 'uLightUp', 'uLight', 'uShadowRange', 'uShadow', 'uSky', 'uHasSky'];
   return { value: result, locations: Object.fromEntries(names.map(name => [name, gl.getUniformLocation(result, name)])),
    attributes: Object.fromEntries(['aPosition', 'aColor', 'aNormal', 'aSurface'].map(name => [name, gl.getAttribLocation(result, name)])) };
  }

  function createResources() {
   const main = program(vertex, fragment), depth = program(depthVertex, depthFragment);
   const shadowTexture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowSize, shadowSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
   for (const name of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, name, gl.NEAREST);
   for (const name of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, name, gl.CLAMP_TO_EDGE);
   const shadowDepth = gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER, shadowDepth);
   gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowSize, shadowSize);
   const framebuffer = gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
   gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
   gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowDepth);
   if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Shadow framebuffer unavailable');
   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
   const skyTexture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, skyTexture);
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([160, 125, 150, 255]));
   for (const name of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, name, gl.LINEAR);
   for (const name of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, name, gl.CLAMP_TO_EDGE);
   return { main, depth, shadowTexture, shadowDepth, framebuffer, skyTexture, skyLoaded: false,
    skyUnavailable: false, staticBuffer: gl.createBuffer(), carBuffer: gl.createBuffer(), version: -1, count: 0 };
  }

  surface.addEventListener('webglcontextlost', event => { event.preventDefault();resources = undefined; });
  surface.addEventListener('webglcontextrestored', () => { resources = undefined;failure = null; });

  function bind(buffer, pipeline) {
   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
   for (const [name, size, offset] of [['aPosition', 3, 0], ['aColor', 3, 12], ['aNormal', 3, 24], ['aSurface', 4, 36]]) {
    const index = pipeline.attributes[name];if (index < 0) continue;
    gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index, size, gl.FLOAT, false, 52, offset);
   }
  }

  return {
   surface,
   snapshot: () => ({ backend: gl.isContextLost() ? 'software' : resources ? 'materials' : 'unavailable', draws, failure, shadowSize, softwareGpu, renderLimit: Number.isFinite(renderLimit) ? renderLimit : null, skyLoaded: !!resources?.skyLoaded }),
   draw(camera, forward, cameraRight, pitch, focal, horizon, carFaces) {
    if (gl.isContextLost()) { resources = undefined;return false; }
    if (resources === undefined) try { resources = createResources(); } catch (error) { failure = error.message;resources = null; }
    if (!resources) return false;
    const r = resources, ratio = Math.min(devicePixelRatio || 1, 1.5, renderLimit / Math.max(w, h)), width = Math.round(w * ratio), height = Math.round(h * ratio);
    if (surface.width !== width || surface.height !== height) { surface.width = width;surface.height = height; }
    const sky = typeof DriveArt !== 'undefined' ? DriveArt.skyImage : null;
    if (sky?.complete && sky.naturalWidth && !r.skyLoaded && !r.skyUnavailable) {
     gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D, r.skyTexture);
     try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sky);r.skyLoaded = true; }
     catch { r.skyUnavailable = true; }
    }
    bind(r.staticBuffer, r.main);
    if (r.version !== roadMeshVersion) {
     const data = vertices(roadMesh);gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
     r.count = data.length / 13;r.version = roadMeshVersion;
    }
    const dynamic = vertices(carFaces);bind(r.carBuffer, r.main);gl.bufferData(gl.ARRAY_BUFFER, dynamic, gl.DYNAMIC_DRAW);
    const center = [car.x, nearest(car.x, car.y).elevation || 0, car.y];
    const lightUniforms = pipeline => {
     const u = pipeline.locations;gl.uniform3fv(u.uLightCenter, center);gl.uniform3fv(u.uLightRight, right);
     gl.uniform3fv(u.uLightUp, up);gl.uniform3fv(u.uLight, light);gl.uniform1f(u.uShadowRange, shadowRange);
    };
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);gl.viewport(0, 0, shadowSize, shadowSize);
    gl.clearColor(1, 1, 1, 1);gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(r.depth.value);lightUniforms(r.depth);bind(r.staticBuffer, r.depth);gl.drawArrays(gl.TRIANGLES, 0, r.count);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);gl.viewport(0, 0, width, height);gl.clearColor(0, 0, 0, 0);gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(r.main.value);lightUniforms(r.main);
    const u = r.main.locations;gl.uniform3fv(u.uCamera, camera);gl.uniform2fv(u.uForward, forward);gl.uniform2fv(u.uRight, cameraRight);
    gl.uniform2fv(u.uPitch, [Math.cos(pitch), Math.sin(pitch)]);gl.uniform3fv(u.uProjection, [focal * 2 / w, focal * 2 / h, 1 - 2 * horizon / h]);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, r.shadowTexture);gl.uniform1i(u.uShadow, 0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D, r.skyTexture);gl.uniform1i(u.uSky, 1);gl.uniform1f(u.uHasSky, r.skyLoaded ? 1 : 0);
    bind(r.staticBuffer, r.main);gl.drawArrays(gl.TRIANGLES, 0, r.count);
    bind(r.carBuffer, r.main);gl.drawArrays(gl.TRIANGLES, 0, dynamic.length / 13);
    if (gl.isContextLost()) { resources = undefined;return false; }
    ctx.drawImage(surface, 0, 0, w, h);
    if (gl.isContextLost()) { resources = undefined;return false; }
    draws++;return true;
   }
  };
 }
 return { createRenderer };
})();
