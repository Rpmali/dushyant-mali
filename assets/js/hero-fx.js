/* hero-fx.js: the WebGL light-leak background behind the top of the page, driven only by
 motion.js: fx = window.HeroFX.start(hero, { before, colourA, colourB, onLost }) with
 "#rrggbb" colours from the CSS tokens. Returns null when WebGL is unavailable (motion.js
 shows a CSS gradient instead), else { pause(), resume(), resize(), stop() }. At most 960 px
 wide, device pixel ratio 1, 30 fps; the flicker is a 3% ripple at about 1 Hz (no flashing). */
(() => {
'use strict';
if (typeof window === 'undefined' || typeof document === 'undefined') return;

const MAX_WIDTH = 960;
const FPS = 30;

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FRAG = [
  'precision mediump float;',
  'uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;',
  'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
  'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
  ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
  'void main(){',
  ' vec2 uv=gl_FragCoord.xy/r;float ar=r.x/r.y;vec2 p=vec2(uv.x*ar,uv.y);float s=t*.05;',
  /* slow mottled noise, like light through a film gate */
  ' float m=n(p*1.6+vec2(s,-s*.7))*.6+n(p*3.2-vec2(s*.5,s))*.4;',
  /* three drifting leak centres: top right (strong), bottom left (faint), middle */
  ' vec2 c1=vec2(.86*ar+.12*sin(s*2.1),.82+.1*cos(s*1.7));',
  ' vec2 c2=vec2(.02*ar+.12*cos(s*1.3),.08+.1*sin(s*2.3));',
  ' vec2 c3=vec2(.55*ar+.25*sin(s*.9),.5+.2*cos(s*1.1));',
  ' float g=.55*exp(-2.2*length(p-c1))+.2*exp(-3.*length(p-c2))+.2*exp(-3.*length(p-c3));',
  ' g*=.55+.9*m;',
  /* a soft diagonal streak that wanders */
  ' g+=smoothstep(.34,0.,abs(uv.x+uv.y*.6-(.6+.25*sin(s*1.9)))-.06)*.16*m;',
  /* tiny slow flicker (3%, about 1 Hz) */
  ' float fl=1.+.03*sin(t*7.)*sin(t*2.3);',
  /* colour: leak red warmed towards the cream, with the blue held back so it reads orange */
  ' vec3 c=mix(a,b,clamp(m*1.2,0.,1.))*vec3(1.,.92,.62)*g*.85*fl;',
  /* film grain */
  ' c+=(h(gl_FragCoord.xy+fract(t)*97.)-.5)*.05;',
  ' c=max(c,0.);float al=min(max(c.r,max(c.g,c.b))*1.4,1.);',
  ' gl_FragColor=vec4(c,al);',
  '}'
].join('\n');

function parseHex(value) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null; // a context lost before it was used returns null objects
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Program, triangle and uniforms; null when anything is missing or throws. */
function setup(gl, colourA, colourB) {
  try {
    const program = gl.createProgram();
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const buffer = gl.createBuffer();
    if (!program || !vert || !frag || !buffer) return null;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    // One triangle covering the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(gl.getUniformLocation(program, 'a'), colourA);
    gl.uniform3fv(gl.getUniformLocation(program, 'b'), colourB);
    gl.clearColor(0, 0, 0, 0);
    return { res: gl.getUniformLocation(program, 'r'), time: gl.getUniformLocation(program, 't') };
  } catch (e) {
    return null;
  }
}

function start(host, options) {
  const opts = options || {};
  if (!host || typeof host.appendChild !== 'function' || typeof window.requestAnimationFrame !== 'function') return null;
  const colourA = parseHex(opts.colourA);
  const colourB = parseHex(opts.colourB);
  if (!colourA || !colourB) return null;

  const attrs = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  let canvas;
  let gl = null;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) gl = null;
  } catch (e) {
    gl = null;
  }
  if (!gl || typeof gl.createShader !== 'function') return null;
  const u = setup(gl, colourA, colourB);
  if (!u) return null;
  const uRes = u.res;
  const uTime = u.time;

  canvas.className = 'hero__fx';
  canvas.setAttribute('aria-hidden', 'true');

  let raf = 0;
  let last = 0;
  let running = false;
  let lost = false;
  let frames = 0;
  const t0 = window.performance ? performance.now() : Date.now();

  function resize() {
    if (lost) return;
    const hostW = Math.max(1, host.clientWidth);
    const hostH = Math.max(1, host.clientHeight);
    const w = Math.min(MAX_WIDTH, Math.round(hostW));
    const h = Math.max(1, Math.round(w * hostH / hostW));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
  }

  function draw(now) {
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames += 1;
    if (window.__motionStats) window.__motionStats.heroFrames += 1;
  }

  function frame(now) {
    raf = 0;
    if (!running || lost) return;
    raf = window.requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return; // hold at 30 fps
    last = now;
    draw(now);
  }

  function pause() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function resume() {
    if (running || lost) return;
    running = true;
    if (!raf) raf = window.requestAnimationFrame(frame);
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }
  // The host changes height on its own too (the timeline bar shortens it, fonts arrive),
  // so watch the host, not only the window; the canvas then stays matched to it.
  let observer = null;
  try {
    if (typeof window.ResizeObserver === 'function') {
      observer = new window.ResizeObserver(onResize);
      observer.observe(host);
    }
  } catch (e) {
    observer = null;
  }

  /** Listeners off, canvas out: shared by stop() and a lost context. */
  function teardown() {
    pause();
    lost = true;
    clearTimeout(resizeTimer);
    if (observer) observer.disconnect();
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.remove();
  }

  function onLost(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (lost) return;
    teardown();
    if (typeof opts.onLost === 'function') opts.onLost();
  }

  function stop() {
    if (lost) return;
    teardown();
    try {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (e) {
      /* Some browsers refuse; the canvas is removed either way. */
    }
  }

  canvas.addEventListener('webglcontextlost', onLost, false);
  window.addEventListener('resize', onResize, { passive: true });
  if (opts.before && opts.before.parentNode === host) host.insertBefore(canvas, opts.before);
  else host.appendChild(canvas);
  resize();
  draw(t0);

  return {
    pause: pause,
    resume: resume,
    resize: resize,
    stop: stop,
    frames: () => frames,
    canvas: canvas
  };
}

window.HeroFX = { start: start, MAX_WIDTH: MAX_WIDTH, FPS: FPS };
})();
