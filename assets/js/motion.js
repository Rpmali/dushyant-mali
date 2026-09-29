/* motion.js: the animation layer (GSAP, ScrollTrigger, Lenis) on top of main.js. If it fails
 to load or throws, the page works as before. Sections 1 to 9; everything a run creates is
 undone by stop() (see README, "For whoever helps maintain this"). */
(() => {
'use strict';
if (typeof window === 'undefined' || typeof document === 'undefined') return;

const root = document.documentElement;
const STORAGE_KEY = 'dm-motion-paused'; // same key as main.js: "1" = animation off
const SESSION_KEY = 'dm-intro-played';
const SECTION_IDS = ['work', 'services', 'process', 'about', 'contact'];
const stats = window.__motionStats = window.__motionStats || { heroFrames: 0, cursorFrames: 0 };

/* ---- 1. Gate and tier ---- */

function mq(query) {
  try {
    return window.matchMedia(query);
  } catch (e) {
    return { matches: false };
  }
}

const reduceMQ = mq('(prefers-reduced-motion: reduce)');
const fineMQ = mq('(hover: hover) and (pointer: fine)');

function readOff() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

let off = readOff();

function libsPresent() {
  const g = window.gsap;
  return !!g && typeof g.to === 'function' && typeof g.context === 'function' && !!window.ScrollTrigger;
}

/** The single gate. False: motion.js does nothing beyond keeping the switch working. */
function motionAllowed() {
  return !off && !reduceMQ.matches && libsPresent() && typeof window.requestAnimationFrame === 'function';
}

/** "lite" skips the cursor, the WebGL hero, the whip-pan and the pinned film strip. */
function motionTier() {
  const nav = window.navigator || {};
  if (!fineMQ.matches || mq('(pointer: coarse)').matches || mq('(hover: none)').matches) return 'lite';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return 'lite';
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return 'lite';
  if (nav.connection && nav.connection.saveData) return 'lite';
  return 'full';
}

/* ---- 2. Helpers ---- */

let active = false;
let tier = 'full';
let ctx = null;      // gsap.context of the current run
let cleanups = [];   // undo list for the current run
let lenis = null;
let heroCtl = null;  // { pause(), resume() } of the hero background

function safely(name, fn) {
  try {
    return fn();
  } catch (error) {
    if (window.console && console.error) console.error('[motion] ' + name + ' failed:', error);
    return undefined;
  }
}

function $(selector, scope) {
  return (scope || document).querySelector(selector);
}

function $$(selector, scope) {
  return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Create an element. Strings in children become text, never HTML. */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.keys(attrs || {}).forEach((key) => {
    const value = attrs[key];
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined || child === false || child === '') return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

/** Register something to undo on stop(). */
function later(fn) {
  if (typeof fn === 'function') cleanups.push(fn);
}

/** addEventListener that is removed on stop(). */
function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  later(() => { target.removeEventListener(type, fn, opts); });
}

/** Run fn so that tweens it makes in a callback still belong to the context. */
function track(fn) {
  if (ctx) ctx.add(fn);
  else fn();
}

function hidden() {
  return document.hidden === true || document.visibilityState === 'hidden';
}

/** cb(true) while target is on screen and the tab visible, cb(false) otherwise; returns a stop function. */
function whenVisible(target, cb) {
  let onScreen = true;
  let io = null;
  const update = () => { cb(onScreen && !hidden()); };
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      update();
    }, { threshold: 0 });
    io.observe(target);
  }
  document.addEventListener('visibilitychange', update);
  update();
  return () => {
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', update);
  };
}

/** A relative media path from content.js ("assets/video/clip.mp4"); '' if unusable. */
function mediaSrc(value, extensions) {
  const s = text(value);
  if (!s || /["'<>\\`\s]/.test(s) || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.slice(0, 2) === '//') return '';
  if (!new RegExp('\\.(' + extensions + ')$', 'i').test(s)) return '';
  return s.replace(/^\/+/, '');
}

function warn(message) {
  if (window.console && console.warn) console.warn('[motion] ' + message);
}

/** What main.js rendered (window.SITE_RENDERED), read defensively. */
function siteData() {
  const s = window.SITE_RENDERED && typeof window.SITE_RENDERED === 'object' ? window.SITE_RENDERED : {};
  const reel = s.showreel && typeof s.showreel === 'object' ? s.showreel : {};
  const motion = s.motion && typeof s.motion === 'object' ? s.motion : {};
  const grade = s.grade && typeof s.grade === 'object' ? s.grade : {};
  return {
    name: text(s.name),
    poster: text(reel.poster),
    clips: Array.isArray(reel.clips) ? reel.clips.map(text).filter(Boolean) : [],
    intro: motion.intro !== false,
    grade: { before: text(grade.before), after: text(grade.after) },
    services: Array.isArray(s.services) ? s.services : [],
    projects: Array.isArray(s.projects) ? s.projects : []
  };
}

/* ---- 3. Smooth scroll: Lenis on desktop, anchors, ScrollTrigger sync, whip-pan ---- */

function headerOffset() {
  const v = parseFloat(getComputedStyle(root).scrollPaddingTop);
  return isFinite(v) && v > 0 ? v : 80;
}

/** Focus the section (no ring) so the next Tab continues inside it, as after a native #jump. */
function focusTarget(node) {
  if (!node.hasAttribute('tabindex')) {
    node.setAttribute('tabindex', '-1');
    node.setAttribute('data-motion-tabindex', '');
    node.addEventListener('blur', function onBlur() {
      node.removeEventListener('blur', onBlur);
      if (node.hasAttribute('data-motion-tabindex')) {
        node.removeAttribute('tabindex');
        node.removeAttribute('data-motion-tabindex');
      }
    });
  }
  try {
    node.focus({ preventScroll: true });
  } catch (e) {
    node.focus();
  }
}

/** The element a "#fragment" names: the body for "#top", else the section; null when hidden. */
function fragmentTarget(fragment) {
  let id = fragment.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch (e) {
    /* left as written */
  }
  const node = id === 'top' ? document.body : document.getElementById(id);
  return node && !node.hidden ? node : null;
}

/** Scroll to a section (element or id) under the header, through Lenis when active. */
function scrollTo(target, opts) {
  const o = opts || {};
  const node = typeof target === 'string' ? document.getElementById(target) : target;
  if (!node) return;
  const toTop = node === document.body || node.id === 'top';
  // A number, not the element: Lenis would add the page's scroll-padding on top of the offset.
  const top = toTop ? 0 : Math.max(0, node.getBoundingClientRect().top + window.pageYOffset - headerOffset());
  if (lenis) lenis.scrollTo(top, o.immediate ? { immediate: true, force: true } : { duration: toTop ? 1 : 1.1 });
  else {
    if (o.immediate) root.style.scrollBehavior = 'auto'; // the foundation's CSS would glide
    window.scrollTo({ top: top, behavior: o.immediate ? 'auto' : 'smooth' });
    root.style.scrollBehavior = '';
  }
  if (!toTop && !o.noFocus) focusTarget(node);
}

/** Scroll to an absolute position, through Lenis when active. */
function scrollToY(top, duration) {
  if (lenis) lenis.scrollTo(top, { duration: duration || 0.8 });
  else window.scrollTo({ top: top, behavior: 'smooth' });
}

function initScroll() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (!window.Lenis || !fineMQ.matches) return; // touch and phones keep native scrolling

  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false });
  const tick = (time) => { lenis.raf(time * 1000); };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  // Lenis re-adds its html classes from a 400 ms timer that destroy() does not clear.
  const stripClasses = () => {
    if (lenis) return; // a new instance owns them again
    Array.prototype.slice.call(root.classList).forEach((c) => {
      if (c === 'lenis' || c.indexOf('lenis-') === 0) root.classList.remove(c);
    });
  };
  later(() => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
    lenis = null;
    stripClasses();
    setTimeout(stripClasses, 450);
  });

  // A native focus scroll during a Lenis animation must win, or the focused element stays off screen.
  on(document, 'focusin', () => {
    if (!lenis || !(lenis.isScrolling === 'smooth' || (lenis.animate && lenis.animate.isRunning))) return;
    const before = window.pageYOffset; // the browser scrolls after the focus events, in this task
    Promise.resolve().then(() => {
      const now = window.pageYOffset;
      if (lenis && now !== before && Math.abs(now - lenis.animatedScroll) > 1) lenis.scrollTo(now, { immediate: true, force: true });
    });
  }, true);

  // In-page links go through Lenis with the header offset; the skip link keeps its native jump.
  on(document, 'click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains('skip-link')) return;
    const node = fragmentTarget(a.getAttribute('href'));
    if (!node) return;
    event.preventDefault();
    scrollTo(node);
    try {
      history.pushState(null, '', a.getAttribute('href'));
    } catch (e) {
      /* a sandbox may refuse; the scroll already happened */
    }
  });

  // Whip-pan: fast wheel scrolling skews the grid up to 4 deg (skewX, 2 deg, on the sideways film strip).
  const grid = $('#work-grid');
  if (tier !== 'full' || !grid || grid.hidden) return;
  const skewY = gsap.quickTo(grid, 'skewY', { duration: 0.5, ease: 'power3' });
  const skewX = gsap.quickTo(grid, 'skewX', { duration: 0.5, ease: 'power3' });
  let inView = false;
  let skewing = false;
  ScrollTrigger.create({ trigger: grid, start: 'top bottom', end: 'bottom top', onToggle: (self) => { inView = self.isActive; } });
  lenis.on('scroll', (e) => {
    if (!inView && !skewing) return;
    const strip = grid.classList.contains('work-grid--strip');
    const v = gsap.utils.clamp(-4, 4, (e.velocity || 0) * 0.06);
    const moving = inView && Math.abs(v) > 0.05;
    if (moving !== skewing) {
      skewing = moving;
      grid.classList.toggle('is-skewing', moving);
    }
    skewY(moving && !strip ? v : 0);
    skewX(moving && strip ? v / 2 : 0);
  });
  later(() => { grid.classList.remove('is-skewing'); });
}

/* ---- 4. Hero ---- */

/** User-perceived characters: a Gujarati or Devanagari vowel sign stays with its consonant. */
function graphemes(word) {
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word), (s) => s.segment);
    }
    return word.match(new RegExp('\\P{M}\\p{M}*', 'gu')) || Array.from(word);
  } catch (e) {
    return Array.from(word);
  }
}

/** Wrap each letter of the name in a span; the h1 keeps its full accessible name. */
function splitTitle(title, name) {
  const full = title ? text(title.textContent) || name : '';
  if (!full) return [];
  const original = title.textContent;
  const letters = [];
  const restore = () => {
    title.textContent = original;
    title.removeAttribute('aria-label');
  };
  title.setAttribute('aria-label', full);
  title.textContent = '';
  full.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      title.appendChild(document.createTextNode(' '));
      return;
    }
    const word = el('span', { class: 'hero__word', 'aria-hidden': 'true' });
    graphemes(part).forEach((ch) => {
      const span = el('span', { class: 'hero__ch', text: ch });
      word.appendChild(span);
      letters.push(span);
    });
    title.appendChild(word);
  });
  // A word the foundation could only fit by breaking it animates as one block instead.
  if (title.scrollWidth > title.clientWidth + 1) {
    restore();
    return [];
  }
  later(restore);
  return letters;
}

let started = false; // the countdown belongs to the first start only, never to the switch

function introAllowed(site) {
  if (!site.intro || started) return false;
  const banner = $('#preview-banner');
  if (banner && !banner.hidden) return false; // the owner is reading notes about content.js
  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === '1') return false;
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch (e) {
    return false; // cannot remember it: better never than on every page load
  }
  return true;
}

/** The 3-2-1 film leader. done() runs when the page is revealed, or at once when not allowed. */
function runIntro(site, done) {
  if (!introAllowed(site)) {
    done();
    return;
  }
  const gsap = window.gsap;
  const num = el('div', { class: 'intro__num', text: '3' });
  const sweep = el('div', { class: 'intro__sweep' });
  const stage = el('div', { class: 'intro__stage' }, [sweep, el('div', { class: 'intro__ring' }), el('div', { class: 'intro__cross' }), num]);
  const left = el('div', { class: 'intro__shutter intro__shutter--l' });
  const right = el('div', { class: 'intro__shutter intro__shutter--r' });
  const hint = el('p', { class: 'intro__hint', text: 'Click or press any key to skip' });
  const overlay = el('div', { class: 'intro', 'aria-hidden': 'true' }, [left, right, stage, hint]);
  document.body.appendChild(overlay);

  let finished = false;
  const sweepState = { a: 0 };
  const tl = gsap.timeline({ onComplete: finish });
  [3, 2, 1].forEach((n, i) => {
    const at = i * 0.533;
    tl.call(() => { num.textContent = String(n); }, null, at);
    tl.fromTo(num, { scale: 1.15, opacity: 0.6 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' }, at);
    tl.fromTo(sweepState, { a: 0 }, {
      a: 360,
      duration: 0.533,
      ease: 'none',
      onUpdate: () => { sweep.style.setProperty('--sweep', sweepState.a + 'deg'); }
    }, at);
  });
  tl.addLabel('wipe', 1.6);
  tl.set(overlay, { pointerEvents: 'none' }, 'wipe');
  tl.to([stage, hint], { opacity: 0, duration: 0.15 }, 'wipe');
  tl.to(left, { xPercent: -100, duration: 0.45, ease: 'power3.inOut' }, 'wipe');
  tl.to(right, { xPercent: 100, duration: 0.45, ease: 'power3.inOut' }, 'wipe');

  function skip() {
    if (!finished && tl.time() < tl.labels.wipe) tl.seek('wipe');
  }
  function finish() {
    if (finished) return;
    finished = true;
    document.removeEventListener('keydown', skip);
    overlay.remove();
    done();
  }
  document.addEventListener('keydown', skip);
  overlay.addEventListener('pointerdown', skip);
  later(() => {
    if (finished) return;
    finished = true;
    document.removeEventListener('keydown', skip);
    tl.kill();
    overlay.remove();
  });
}

/** Brackets and thirds drift toward the pointer (max 12 px); the text answers slightly. */
function pointerParallax(hero, vf, content) {
  if (tier !== 'full' || !vf) return null;
  const gsap = window.gsap;
  const move = [vf, content].filter(Boolean).map((node, i) => {
    const range = i === 0 ? 12 : -4;
    const x = gsap.quickTo(node, 'x', { duration: 0.7 + i * 0.2, ease: 'power2' });
    const y = gsap.quickTo(node, 'y', { duration: 0.7 + i * 0.2, ease: 'power2' });
    return (nx, ny) => { x(nx * range); y(ny * range); };
  });
  let armed = false; // only after the entrance, so the two never fight over y
  on(hero, 'pointermove', (event) => {
    if (!armed || (event.pointerType && event.pointerType !== 'mouse')) return;
    const r = hero.getBoundingClientRect();
    const nx = ((event.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
    const ny = ((event.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
    move.forEach((fn) => { fn(nx, ny); });
  }, { passive: true });
  on(hero, 'pointerleave', () => { move.forEach((fn) => { fn(0, 0); }); });
  return function arm() { armed = true; };
}

/** Owner clips grouped: [["a.webm", "a.mp4"], ["b.mp4"]] (same name = alternatives of one clip). */
function groupClips(paths) {
  const groups = [];
  const index = {};
  paths.forEach((raw) => {
    const src = mediaSrc(raw, 'mp4|webm');
    if (!src) {
      warn('showreel.clips: "' + raw + '" is not a relative .mp4/.webm path; ignored.');
      return;
    }
    const key = src.replace(/\.(mp4|webm)$/i, '').toLowerCase();
    if (!(key in index)) {
      index[key] = groups.length;
      groups.push([]);
    }
    groups[index[key]].push(src);
  });
  return groups;
}

/** Muted looping clips behind the hero: preload none, play only while wanted. Returns { pause, resume }. */
function heroVideo(hero, shade, clips, poster, onFail) {
  const video = el('video', { class: 'hero__clip', muted: true, playsinline: true, preload: 'none', 'aria-hidden': 'true', disablepictureinpicture: true, disableremoteplayback: true });
  video.muted = true; // the attribute alone is not enough in every browser
  const posterSrc = mediaSrc(poster, 'jpe?g|png|webp|avif|gif');
  if (posterSrc) video.poster = posterSrc;
  if (clips.length === 1) video.loop = true;
  let index = 0;
  let wanted = false;
  let dead = false;

  function play() {
    if (dead) return;
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay refused: the poster stays */ });
  }
  function remove() {
    dead = true;
    video.pause();
    video.remove();
    hero.classList.remove('hero--has-clip');
  }
  function load(i) {
    const group = clips[i];
    while (video.firstChild) video.removeChild(video.firstChild);
    group.forEach((src, j) => {
      const source = el('source', { src: src, type: /\.webm$/i.test(src) ? 'video/webm' : 'video/mp4' });
      if (j === group.length - 1) {
        // No source of this clip plays: drop it and carry on with the others.
        source.addEventListener('error', () => {
          const at = clips.indexOf(group);
          if (dead || at === -1) return;
          clips.splice(at, 1);
          warn('showreel.clips: "' + src + '" could not be played; skipped. Check the file name and folder.');
          if (!clips.length) {
            remove();
            onFail();
            return;
          }
          video.loop = clips.length === 1;
          index = at % clips.length;
          load(index);
          if (wanted) play();
        });
      }
      video.appendChild(source);
    });
    video.load();
  }
  video.addEventListener('ended', () => {
    if (clips.length < 2) return;
    index = (index + 1) % clips.length;
    load(index);
    if (wanted) play();
  });
  load(0);
  hero.insertBefore(video, shade);
  hero.classList.add('hero--has-clip');
  later(() => { if (!dead) remove(); });
  return {
    resume: () => { wanted = true; play(); },
    pause: () => { wanted = false; if (!dead) video.pause(); }
  };
}

/** The hero background: the owner's clips, else WebGL leaks (tier full), else a CSS leak. */
function heroBackground(hero, site) {
  const shade = $('.hero__shade', hero);
  let onScreen = true;
  let dialogOpen = root.classList.contains('is-dialog-open');

  function sync() {
    const run = onScreen && !dialogOpen;
    hero.classList.toggle('is-offscreen', !run);
    if (heroCtl) heroCtl[run ? 'resume' : 'pause']();
  }
  function cssLeak() {
    const leak = el('div', { class: 'hero__leak', 'aria-hidden': 'true' }, [el('span'), el('span')]);
    hero.insertBefore(leak, shade);
    later(() => { leak.remove(); });
  }
  function fallback() {
    heroCtl = null;
    if (tier === 'full' && window.HeroFX && typeof window.HeroFX.start === 'function') {
      const styles = getComputedStyle(root);
      const colour = (token, base) => {
        const v = text(styles.getPropertyValue(token));
        return /^#[0-9a-f]{6}$/i.test(v) ? v : text(styles.getPropertyValue(base));
      };
      let fx = safely('hero-fx', () => {
        return window.HeroFX.start(hero, {
          before: shade,
          colourA: colour('--m-leak-a', '--c-rec'),
          colourB: colour('--m-leak-b', '--c-text'),
          onLost: () => { fx = null; cssLeak(); }
        });
      }) || null;
      if (fx) {
        heroCtl = { resume: () => { if (fx) fx.resume(); }, pause: () => { if (fx) fx.pause(); } };
        later(() => { if (fx) fx.stop(); fx = null; });
        sync();
        return;
      }
    }
    cssLeak();
  }

  const clips = groupClips(site.clips);
  if (clips.length) heroCtl = heroVideo(hero, shade, clips, site.poster, fallback);
  else fallback();

  later(whenVisible(hero, (visible) => { onScreen = visible; sync(); }));
  on(document, 'player:open', () => { dialogOpen = true; sync(); });
  on(document, 'player:close', () => { dialogOpen = false; sync(); });
  later(() => { heroCtl = null; hero.classList.remove('is-offscreen'); });
}

function initHero(site) {
  const gsap = window.gsap;
  const hero = $('#hero');
  if (!hero) return;
  const title = $('#hero-title');
  const content = $('.hero__content', hero);
  const vf = $('.hero__vf', hero);

  // Letterbox panels that open to the bar height.
  const barPx = parseFloat(getComputedStyle(hero, '::before').height) || 16;
  const panels = [el('div', { class: 'lb lb--top', 'aria-hidden': 'true' }), el('div', { class: 'lb lb--bottom', 'aria-hidden': 'true' })];
  panels.forEach((p) => { hero.appendChild(p); });
  later(() => { panels.forEach((p) => { p.remove(); }); });

  const letters = splitTitle(title, site.name);
  const hiddenParts = [content, vf].filter(Boolean).concat(letters);

  // Start states, set in the same task as the motion-on class, so nothing flashes.
  if (content) gsap.set(content, { opacity: 0, y: 28 });
  if (vf) gsap.set(vf, { opacity: 0 });
  if (letters.length) gsap.set(letters, { yPercent: 70, opacity: 0, rotateX: -60, transformPerspective: 600 });

  // Whatever fails from here on, the hero is shown.
  const show = () => {
    gsap.set(hiddenParts, { clearProps: 'all' });
    panels.forEach((p) => { p.hidden = true; });
  };
  safely('hero background', () => { heroBackground(hero, site); });
  const arm = safely('hero parallax', () => pointerParallax(hero, vf, content));

  const play = () => { // runs after the countdown, outside safely('hero')
    const ok = safely('hero entrance', () => {
      track(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.to(panels, {
          scaleY: Math.min(1, barPx / Math.max(1, hero.clientHeight / 2)),
          duration: 1.1,
          ease: 'power3.inOut',
          onComplete: () => { panels.forEach((p) => { p.hidden = true; }); }
        }, 0);
        if (vf) tl.to(vf, { opacity: 1, duration: 1 }, 0.3);
        if (content) tl.to(content, { opacity: 1, y: 0, duration: 0.9, onComplete: () => { if (arm) arm(); } }, 0.35);
        if (letters.length) tl.to(letters, { yPercent: 0, opacity: 1, rotateX: 0, duration: 0.7, stagger: 0.035 }, 0.45);
      });
      return true;
    });
    if (!ok) show();
  };
  try {
    runIntro(site, play);
  } catch (error) {
    show();
    throw error;
  }
}

/* ---- 5. Timeline bar (desktop) and progress line (phones) ---- */

function initTimeline() {
  const ScrollTrigger = window.ScrollTrigger;
  const nav = $('#site-nav');
  const items = SECTION_IDS.map((id) => {
    const section = document.getElementById(id);
    if (!section || section.hidden) return null;
    const link = nav ? nav.querySelector('a[href="#' + id + '"]') : null;
    return { section: section, name: text(link && link.textContent) || id };
  }).filter(Boolean);
  if (!items.length) return;

  const progress = el('div', { class: 'tl__progress', 'aria-hidden': 'true' });
  const labelText = el('span', { class: 'tl__label-text', text: '00 / TOP' });
  const head = el('span', { class: 'tl__head', 'aria-hidden': 'true' });
  const buttons = items.map((item, i) => {
    const button = el('button', { type: 'button', class: 'tl__clip' }, [
      el('span', { class: 'tl__num', 'aria-hidden': 'true', text: pad(i + 1) }),
      el('span', { class: 'tl__name', text: item.name })
    ]);
    button.addEventListener('click', () => { scrollTo(item.section); });
    return button;
  });
  const bar = el('nav', { class: 'tl', 'aria-label': 'Timeline' }, [
    el('span', { class: 'tl__label', 'aria-hidden': 'true' }, [el('span', { class: 'rec__dot' }), labelText]),
    el('div', { class: 'tl__track' }, buttons.concat([head]))
  ]);
  document.body.appendChild(progress);
  document.body.appendChild(bar);
  root.classList.add('has-tl');
  later(() => {
    progress.remove();
    bar.remove();
    root.classList.remove('has-tl');
  });

  // Geometry is read on refresh only; scroll updates just write transforms.
  const tops = [];
  const heights = [];
  const lefts = [];
  const widths = [];
  let max = 1;
  let viewH = 1;
  let current = -2;

  function measure() {
    const y = window.pageYOffset;
    items.forEach((item, i) => {
      const r = item.section.getBoundingClientRect();
      tops[i] = r.top + y;
      heights[i] = Math.max(1, r.height);
    });
    viewH = window.innerHeight;
    max = Math.max(1, root.scrollHeight - viewH);
    // Weights follow the section heights, capped at twice the median so a pinned strip cannot starve a label.
    const sorted = heights.slice().sort((a, b) => a - b);
    const cap = 2 * sorted[Math.floor(sorted.length / 2)];
    buttons.forEach((b, i) => { b.style.flexGrow = String(Math.round(Math.min(heights[i], cap))); });
    buttons.forEach((b, i) => {
      lefts[i] = b.offsetLeft;
      widths[i] = b.offsetWidth;
    });
  }

  function update(scroll) {
    progress.style.transform = 'scaleX(' + Math.min(1, Math.max(0, scroll / max)).toFixed(4) + ')';
    const probe = scroll + viewH * 0.35;
    let idx = -1;
    for (let i = 0; i < tops.length; i += 1) if (probe >= tops[i]) idx = i;
    const x = idx < 0 ? 0 : lefts[idx] + widths[idx] * Math.min(1, (probe - tops[idx]) / heights[idx]);
    head.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    if (idx === current) return;
    current = idx;
    buttons.forEach((b, i) => {
      if (i === idx) b.setAttribute('aria-current', 'location');
      else b.removeAttribute('aria-current');
    });
    labelText.textContent = idx < 0 ? '00 / TOP' : pad(idx + 1) + ' / ' + items[idx].name;
  }

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => { update(self.scroll()); },
    onRefresh: (self) => {
      measure();
      update(self.scroll());
    }
  });
  measure();
  update(window.pageYOffset);
}

/* ---- 6. Cursor (tier full: a mouse with hover). The native cursor stays visible. ---- */

function initCursor() {
  if (tier !== 'full' || !fineMQ.matches) return;
  const textEl = el('span', { class: 'cur__text' });
  const cur = el('div', { class: 'cur', 'aria-hidden': 'true' }, [el('span', { class: 'cur__ring' }), el('span', { class: 'cur__dot' }), textEl]);
  document.body.appendChild(cur);
  root.classList.add('has-cursor');
  later(() => {
    cur.remove();
    root.classList.remove('has-cursor');
  });

  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  let shown = false;

  function loop() {
    raf = 0;
    x += (tx - x) * 0.32;
    y += (ty - y) * 0.32;
    cur.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    stats.cursorFrames += 1;
    if (Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) raf = window.requestAnimationFrame(loop);
  }
  function show(v) {
    if (shown === v) return;
    shown = v;
    cur.classList.toggle('is-on', v);
    if (!v && raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  function state(target) {
    let mode = '';
    if (target && target.closest) {
      const tagged = target.closest('[data-cursor]');
      const card = target.closest('.card');
      if (tagged) mode = tagged.getAttribute('data-cursor') || '';
      else if (card) mode = card.querySelector('.card__badge--play') ? 'play' : 'link';
      else if (target.closest('a, button, input, select, textarea, label, summary, [role="button"]')) mode = 'link';
    }
    cur.classList.toggle('is-play', mode === 'play');
    cur.classList.toggle('is-drag', mode === 'drag');
    cur.classList.toggle('is-link', mode === 'link');
    textEl.textContent = mode === 'play' ? 'PLAY' : (mode === 'drag' ? 'DRAG' : '');
  }

  on(document, 'pointermove', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen' || hidden()) {
      show(false);
      return;
    }
    tx = event.clientX;
    ty = event.clientY;
    if (!shown) {
      x = tx;
      y = ty;
      show(true);
    }
    if (!raf && !hidden()) raf = window.requestAnimationFrame(loop);
  }, { passive: true });
  on(document, 'pointerover', (event) => { state(event.target); }, { passive: true });
  on(document, 'pointerdown', (event) => {
    if (event.pointerType === 'touch') show(false);
    else cur.classList.add('is-down');
  }, { passive: true });
  on(document, 'pointerup', () => { cur.classList.remove('is-down'); }, { passive: true });
  on(root, 'pointerleave', () => { show(false); });
  on(document, 'visibilitychange', () => { if (hidden()) show(false); });
}

/* ---- 7. Reveals: GSAP animates FROM a hidden state on entry; the foundation's IntersectionObserver
   keeps running underneath, so nothing can stay invisible. ---- */

function initReveals() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  $$('[data-reveal]:not([data-reveal-own])').forEach((item) => {
    if (item.classList.contains('is-visible')) return; // already shown (switch turned back on)
    const wipe = item.matches('.about__media, .work-grid__item, .empty__panel');
    const delay = (parseFloat(item.style.getPropertyValue('--reveal-delay')) || 0) / 1000;
    ScrollTrigger.create({
      trigger: item,
      start: 'top 92%',
      once: true,
      onEnter: () => {
        item.classList.add('is-visible');
        track(() => {
          if (wipe) gsap.fromTo(item, { clipPath: 'inset(0 100% 0 0)', opacity: 0.6 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.7, delay: delay, ease: 'power3.out', clearProps: 'clipPath' });
          else gsap.from(item, { opacity: 0, y: 32, duration: 0.6, delay: delay, ease: 'power3.out' });
        });
      }
    });
  });
}

/* ---- 8. Set pieces: one init per section, run from start() inside safely(). An element a section
   reveals itself gets data-reveal-own before initReveals() runs. ---- */

const IMG = 'jpe?g|png|webp|avif|gif';

function svg(tag, attrs, children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs).forEach((key) => { node.setAttribute(key, String(attrs[key])); });
  (children || []).forEach((child) => { node.appendChild(child); });
  return node;
}

function tickIcon() {
  return svg('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [svg('path', { d: 'M5 12.5l4.5 4.5L19 7' })]);
}

/** Run fn once (tweens tracked) when target scrolls into view. */
function onEnter(target, fn) {
  window.ScrollTrigger.create({ trigger: target, start: 'top 88%', once: true, onEnter: () => { track(fn); } });
}

/** The element reveals itself with fn instead of the generic reveal. */
function ownReveal(item, fn) {
  if (item.classList.contains('is-visible')) return;
  item.setAttribute('data-reveal-own', '');
  later(() => { item.removeAttribute('data-reveal-own'); });
  onEnter(item, () => {
    item.classList.add('is-visible');
    fn();
  });
}

/** Tilt node toward the mouse (max degrees); --mx/--my place the specular highlight. */
function tilt(node, max) {
  const gsap = window.gsap;
  // quickTo needs GSAP's own property names (rotationX), not the CSS aliases (rotateX).
  const rx = gsap.quickTo(node, 'rotationX', { duration: 0.5, ease: 'power2' });
  const ry = gsap.quickTo(node, 'rotationY', { duration: 0.5, ease: 'power2' });
  gsap.set(node, { transformPerspective: 900 });
  on(node, 'pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = node.getBoundingClientRect();
    const nx = (e.clientX - r.left) / Math.max(1, r.width);
    const ny = (e.clientY - r.top) / Math.max(1, r.height);
    rx((0.5 - ny) * 2 * max);
    ry((nx - 0.5) * 2 * max);
    node.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
    node.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
  }, { passive: true });
  on(node, 'pointerleave', () => { rx(0); ry(0); });
  later(() => {
    node.style.removeProperty('--mx');
    node.style.removeProperty('--my');
  });
}

/* ---- 8a. Shutter: an iris closes over the page, the player opens through another ---- */

function initShutter() {
  const gsap = window.gsap;
  const dialog = $('#player');
  if (!dialog) return;
  let overlay = null;
  const centre = (node) => {
    const r = node && document.contains(node) ? node.getBoundingClientRect() : null;
    return r && (r.width || r.height) ? [r.left + r.width / 2, r.top + r.height / 2] : [window.innerWidth / 2, window.innerHeight / 2];
  };
  const clear = () => {
    if (!overlay) return;
    gsap.killTweensOf(overlay);
    overlay.remove();
    overlay = null;
  };
  const iris = (at, from, to, done) => {
    clear();
    overlay = document.body.appendChild(el('div', { class: 'shutter', 'aria-hidden': 'true' }));
    const shape = (r) => 'circle(' + r + ' at ' + at[0].toFixed(0) + 'px ' + at[1].toFixed(0) + 'px)';
    gsap.fromTo(overlay, { clipPath: shape(from) }, { clipPath: shape(to), duration: 0.35, ease: 'power2.inOut', onComplete: done });
  };
  on(document, 'player:open', (event) => {
    const d = event.detail || {};
    if (typeof d.proceed !== 'function' || hidden()) return;
    event.preventDefault();
    let opened = false;
    const go = () => {
      if (opened) return;
      opened = true;
      d.proceed(); // the iframe exists from here: at most 300 ms after the click
      gsap.fromTo(dialog, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 0.35, ease: 'power2.out', clearProps: 'clipPath', onComplete: clear });
    };
    iris(centre(d.trigger), '0%', '150%', go);
    setTimeout(go, 300);
  });
  on(document, 'player:close', (event) => {
    if (!hidden()) iris(centre(event.detail && event.detail.trigger), '150%', '0%', clear);
  });
  later(clear);
}

/* ---- 8b. Work: glitch and previews on the cards, film strip or sideways grid, standby panel ---- */

let lastGlitch = 0;

/** RGB-split flash (250 ms), at most one every 340 ms on the whole page: never 3 a second. */
function glitch(card) {
  const now = Date.now();
  if (now - lastGlitch < 340 || card.classList.contains('is-glitch')) return;
  lastGlitch = now;
  card.classList.add('is-glitch');
  setTimeout(() => { card.classList.remove('is-glitch'); }, 300);
}

function initCards(grid) {
  let playing = null; // the one preview clip playing right now
  $$('.card', grid).forEach((card) => {
    const media = $('.card__media', card);
    const li = card.parentElement;
    if (!media || !li) return;
    // Tinted copies of the picture, built on first hover/focus: a background-image is not lazy.
    let layers = null;
    const buildLayers = () => {
      const img = $('.card__img', media);
      const src = img ? img.getAttribute('src') || '' : '';
      layers = src ? [0, 1].map((i) => {
        const layer = el('span', { class: 'card__rgb card__rgb--' + i, 'aria-hidden': 'true' });
        layer.style.backgroundImage = 'url("' + src.replace(/["\\]/g, '') + '")';
        return media.appendChild(layer);
      }) : [];
    };
    const clip = fineMQ.matches ? mediaSrc(li.getAttribute('data-preview'), 'mp4|webm') : '';
    let video = null;
    let watch = null; // pauses a playing preview while the card is off screen or the tab hidden
    let wanted = false;
    function preview(want) {
      if (!clip || li.hasAttribute('data-preview-failed')) return;
      wanted = want;
      if (!want) {
        if (video) video.pause();
        if (playing === video) playing = null;
        if (watch) watch();
        watch = null;
        return;
      }
      if (!video) {
        video = el('video', { class: 'card__preview', muted: true, playsinline: true, loop: true, preload: 'none', 'aria-hidden': 'true', disablepictureinpicture: true, disableremoteplayback: true });
        video.muted = true;
        video.addEventListener('playing', () => { card.classList.add('is-previewing'); });
        video.addEventListener('pause', () => { card.classList.remove('is-previewing'); });
        video.addEventListener('error', () => {
          li.setAttribute('data-preview-failed', '');
          video.remove();
          video = null;
          warn('"' + text(($('.card__title', card) || {}).textContent) + '": preview "' + clip + '" could not be played. Check the file name and folder.');
        });
        video.src = clip;
        media.insertBefore(video, $('.card__vf', media));
      }
      if (playing && playing !== video) playing.pause();
      playing = video;
      const play = () => {
        const p = video.play();
        if (p && p.catch) p.catch(() => { /* autoplay refused: the picture stays */ });
      };
      if (!watch) watch = whenVisible(card, (visible) => { if (!video) return; if (visible && wanted) play(); else video.pause(); });
      else play();
    }
    const enter = (e) => {
      if (e.pointerType === 'touch') return;
      if (!layers) buildLayers();
      glitch(card);
      preview(true);
    };
    on(card, 'pointerenter', enter);
    on(card, 'focusin', enter);
    on(card, 'pointerleave', () => { preview(false); });
    on(card, 'focusout', (e) => { if (!card.contains(e.relatedTarget)) preview(false); });
    later(() => {
      if (layers) layers.forEach((layer) => { layer.remove(); });
      if (watch) watch();
      if (video) {
        video.pause();
        video.remove();
      }
      card.classList.remove('is-glitch', 'is-previewing');
    });
  });
  const pauseAll = () => { if (playing) playing.pause(); };
  on(document, 'visibilitychange', () => { if (hidden()) pauseAll(); });
  on(document, 'player:open', pauseAll);
}

/** The grid as a pinned film strip (desktop, tier full, 4+ projects). Returns its undo. */
function stripMode(grid) {
  const gsap = window.gsap;
  const items = $$('.work-grid__item', grid);
  const undo = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    undo.push(() => { target.removeEventListener(type, fn, opts); });
  };
  const viewport = el('div', { class: 'strip__viewport' });
  const counter = el('span', { class: 'strip__counter', 'aria-hidden': 'true' });
  const reel = el('div', { class: 'strip__reel', 'data-cursor': 'drag' }, [viewport, counter]);
  const wrap = el('div', { class: 'strip' });
  const end = el('li', { class: 'strip__end' }, [
    el('span', { class: 'strip__end-label', 'aria-hidden': 'true' }, [el('span', { class: 'rec__dot' }), 'End of reel']),
    el('a', { class: 'btn btn--primary', href: '#contact', text: 'Get in touch' })
  ]);
  const moved = [$('#work-filters'), $('#work-status'), grid].filter(Boolean); // into the pinned wrapper, back on undo
  moved[0].parentNode.insertBefore(wrap, moved[0]);
  moved.forEach((node) => { wrap.appendChild(node); });
  wrap.appendChild(reel);
  viewport.appendChild(grid);
  grid.classList.add('work-grid--strip');
  grid.appendChild(end);
  items.forEach((li) => {
    li.classList.add('is-visible'); // the reel reveals as one piece; a card off to the right must not stay hidden
    const card = $('.card', li);
    if (card) card.setAttribute('data-cursor', card.querySelector('.card__badge--play') ? 'play' : 'link');
  });

  const distance = () => Math.max(0, grid.scrollWidth - viewport.clientWidth);
  let total = 0;
  let shown = -1;
  const count = (progress) => {
    const idx = total ? Math.min(total, Math.floor(progress * total) + 1) : 0;
    if (idx === shown) return;
    shown = idx;
    counter.textContent = pad(idx) + ' / ' + pad(total);
  };
  const st = window.ScrollTrigger.create({
    trigger: wrap,
    pin: true,
    anticipatePin: 1,
    scrub: 0.35,
    invalidateOnRefresh: true,
    start: () => 'top ' + Math.max(headerOffset(), (window.innerHeight - wrap.offsetHeight) / 2),
    end: () => '+=' + Math.max(1, distance()),
    animation: gsap.to(grid, { x: () => -distance(), ease: 'none' }),
    onToggle: (self) => { grid.classList.toggle('is-moving', self.isActive); },
    onUpdate: (self) => { count(self.progress); },
    onRefresh: (self) => {
      total = items.filter((li) => !li.hidden).length;
      shown = -1;
      count(self.progress);
    }
  });
  gsap.fromTo(reel, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power3.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: wrap, start: 'top 85%', once: true } });

  // A focused card is brought into view: at once for keyboard focus, smoothly after a click.
  let pointerAt = 0;
  listen(reel, 'pointerdown', () => { pointerAt = Date.now(); }, true);
  listen(grid, 'focusin', (e) => {
    const li = e.target.closest && e.target.closest('li');
    const d = distance();
    if (!li || !d) return;
    viewport.scrollLeft = 0;
    const left = li.getBoundingClientRect().left - grid.getBoundingClientRect().left;
    const want = gsap.utils.clamp(0, d, left + li.offsetWidth / 2 - viewport.clientWidth / 2);
    const top = st.start + (want / d) * (st.end - st.start);
    if (Date.now() - pointerAt < 400) scrollToY(top, 0.6);
    else if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
  });

  // Dragging the reel with the mouse scrolls the page 1:1 (the DRAG cursor promises it).
  let drag = null;
  let dragged = false;
  listen(reel, 'pointerdown', (e) => {
    if (e.button === 0 && e.pointerType !== 'touch') drag = { x: e.clientX, y: window.pageYOffset, moved: false };
  });
  listen(reel, 'pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      reel.classList.add('is-dragging');
      try {
        reel.setPointerCapture(e.pointerId);
      } catch (err) {
        /* the drag works without it */
      }
    }
    const top = gsap.utils.clamp(st.start, st.end, drag.y - dx);
    if (lenis) lenis.scrollTo(top, { immediate: true });
    else window.scrollTo(0, top);
  });
  const release = () => {
    if (drag && drag.moved) {
      reel.classList.remove('is-dragging');
      dragged = true; // the click that ends a drag must not open a card
      setTimeout(() => { dragged = false; }, 0);
    }
    drag = null;
  };
  listen(reel, 'pointerup', release);
  listen(reel, 'pointercancel', release);
  listen(reel, 'click', (e) => {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  listen(reel, 'dragstart', (e) => { e.preventDefault(); });

  return () => {
    undo.forEach((fn) => { fn(); });
    end.remove();
    gsap.set(grid, { clearProps: 'transform' }); // the reverted scrub can leave a zero transform
    grid.classList.remove('work-grid--strip', 'is-moving');
    items.forEach((li) => {
      const card = $('.card', li);
      if (card) card.removeAttribute('data-cursor');
    });
    moved.forEach((node) => { wrap.parentNode.insertBefore(node, wrap); });
    wrap.remove();
  };
}

/** The responsive grid with a sideways staggered reveal. */
function gridMode(grid) {
  $$('.work-grid__item', grid).forEach((li, i) => {
    ownReveal(li, () => { window.gsap.from(li, { x: 48, opacity: 0, duration: 0.6, delay: (i % 3) * 0.09, ease: 'power3.out' }); });
  });
}

function initWork() {
  const grid = $('#work-grid');
  const panel = $('.empty__panel');
  if (panel) { // standby monitor: a scan line and a breathing REC dot while on screen
    const scan = panel.appendChild(el('span', { class: 'empty__scan', 'aria-hidden': 'true' }));
    later(whenVisible(panel, (visible) => { panel.classList.toggle('is-live', visible); }));
    later(() => {
      panel.classList.remove('is-live');
      scan.remove();
    });
  }
  if (!grid || grid.hidden) return;
  initCards(grid);
  if (tier === 'full' && $$('.work-grid__item', grid).length >= 4) {
    const mm = window.gsap.matchMedia(); // reverted with the context; a callback's return undoes its DOM
    mm.add('(min-width: 64em)', () => stripMode(grid));
    mm.add('(max-width: 63.99em)', () => { gridMode(grid); });
  } else {
    gridMode(grid);
  }
}

/* ---- 8c. Services: clap in, count up, tilt; the before/after slider ---- */

function initServices() {
  const gsap = window.gsap;
  $$('#services-list .service').forEach((item, i) => {
    const num = $('.service__num', item);
    ownReveal(item, () => {
      const delay = (i % 3) * 0.1;
      // Explicit end values: tilt() primed the transform cache while the card was still hidden.
      gsap.fromTo(item, { rotationX: -40, y: 24, opacity: 0 }, { rotationX: 0, y: 0, opacity: 1, transformOrigin: '50% 0', transformPerspective: 900, duration: 0.7, delay: delay, ease: 'power3.out' });
      if (num) {
        const c = { n: 0 };
        gsap.to(c, { n: i + 1, duration: 0.6, delay: delay, ease: 'power2.out', onUpdate: () => { num.textContent = pad(Math.round(c.n)); } });
      }
    });
    if (fineMQ.matches) tilt(item, 6);
  });
  const grade = $('.grade');
  if (grade) ownReveal(grade, () => { gsap.from(grade, { y: 32, opacity: 0, duration: 0.6, ease: 'power3.out' }); });
}

/* The before/after slider is content, not decoration: built once at boot, kept whatever the switch says. */
function initGrade() {
  const site = siteData();
  const before = mediaSrc(site.grade.before, IMG);
  const after = mediaSrc(site.grade.after, IMG);
  const list = $('#services-list');
  const section = $('#services');
  if (!site.grade.before && !site.grade.after) return;
  if (!before || !after || !list || !section || section.hidden) {
    warn('grade: "before" and "after" must both be picture paths inside the site (e.g. "assets/img/before.jpg") and the Services section shown; the slider is hidden.');
    return;
  }
  const stage = el('div', { class: 'grade__stage' });
  const range = el('input', { class: 'grade__range', type: 'range', min: '0', max: '100', step: '1', value: '50' });
  const box = el('div', { class: 'grade', role: 'group', 'aria-label': 'Before and after colour grading' }, [
    stage,
    el('label', { class: 'grade__control' }, [el('span', { text: 'Before and after: drag to compare' }), range])
  ]);
  const imgs = [before, after].map((src, i) => {
    const img = el('img', { class: 'grade__img' + (i ? ' grade__img--after' : ''), alt: i ? 'The same frame after colour grading' : 'The frame before colour grading', decoding: 'async', loading: 'lazy' });
    img.addEventListener('error', () => {
      box.remove();
      warn('grade: "' + src + '" could not be loaded. Check the file name and folder.');
    });
    img.addEventListener('load', () => {
      const other = imgs[1 - i];
      if (!i && img.naturalWidth) stage.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      if (other.naturalWidth && (other.naturalWidth !== img.naturalWidth || other.naturalHeight !== img.naturalHeight)) warn('grade: the before and after pictures differ in size and will not line up. Export both at the same width and height.');
    });
    img.src = src;
    return stage.appendChild(img);
  });
  stage.appendChild(el('span', { class: 'grade__divider', 'aria-hidden': 'true' }));
  stage.appendChild(el('span', { class: 'grade__tag grade__tag--before', 'aria-hidden': 'true', text: 'Before' }));
  stage.appendChild(el('span', { class: 'grade__tag grade__tag--after', 'aria-hidden': 'true', text: 'After' }));

  const set = (value) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    range.value = String(v);
    range.setAttribute('aria-valuetext', v + '% graded');
    stage.style.setProperty('--pos', v + '%');
  };
  const at = (e) => {
    const r = stage.getBoundingClientRect();
    set(((e.clientX - r.left) / Math.max(1, r.width)) * 100);
  };
  let dragging = false;
  range.addEventListener('input', () => { set(Number(range.value)); });
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    e.preventDefault();
    try {
      stage.setPointerCapture(e.pointerId);
      range.focus({ preventScroll: true }); // so the arrow keys carry on from the drag
    } catch (err) {
      /* the drag still works */
    }
    at(e);
  });
  stage.addEventListener('pointermove', (e) => { if (dragging) at(e); });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });
  set(50);
  list.parentNode.insertBefore(box, list);
}

/* ---- 8d. Process: the clapperboard claps for each step, the export bar fills with scroll ---- */

function initProcess() {
  const gsap = window.gsap;
  const section = $('#process');
  const head = section && $('.section__head', section);
  const steps = $$('#process-list .step');
  if (!section || section.hidden || !head) return;

  const stripes = [];
  for (let i = 0; i < 6; i += 1) stripes.push(svg('rect', { x: 14 + i * 18, y: 20, width: 9, height: 16, transform: 'skewX(-24)', class: 'clap__stripe' }));
  const stick = svg('g', { class: 'clap__stick' }, [svg('rect', { x: 8, y: 20, width: 104, height: 16, rx: 2, class: 'clap__bar' })].concat(stripes));
  const board = head.appendChild(svg('svg', { class: 'clap', viewBox: '0 0 120 100', 'aria-hidden': 'true', focusable: 'false' }, [
    svg('rect', { x: 8, y: 36, width: 104, height: 58, rx: 4, class: 'clap__slate' }),
    svg('path', { d: 'M20 54h80M20 68h56M20 82h68', class: 'clap__lines' }),
    stick
  ]));
  later(() => { board.remove(); });
  gsap.set(stick, { rotate: -25, svgOrigin: '8 36' });

  // Claps queue up, so steps entering together clap one after another.
  const queue = [];
  let busy = false;
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const last = queue.shift();
    track(() => {
      const tl = gsap.timeline({ onComplete: () => { busy = false; pump(); } });
      tl.to(stick, { rotate: 0, duration: 0.15, ease: 'power4.in' })
        .to(board, { y: 2, duration: 0.06, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.15);
      if (!last) tl.to(stick, { rotate: -25, duration: 0.3, ease: 'power2.inOut' }, 0.45);
    });
  }
  steps.forEach((step, i) => {
    ownReveal(step, () => {
      const delay = (i % 4) * 0.12;
      const num = $('.step__num', step);
      const rest = [$('.step__title', step), $('.step__text', step)].filter(Boolean);
      if (num) gsap.from(num, { scale: 1.7, opacity: 0, transformOrigin: '0 100%', duration: 0.4, delay: delay, ease: 'back.out(2.5)' });
      if (rest.length) gsap.from(rest, { y: 18, opacity: 0, duration: 0.5, delay: delay + 0.1, stagger: 0.08, ease: 'power3.out' });
      queue.push(i === steps.length - 1);
      pump();
    });
  });

  // Export bar: the ruler fills with the section's scroll progress and ends with a tick.
  const ruler = $('#process-ruler');
  const headEl = ruler && $('.timeline-ruler__head', ruler);
  if (!headEl) return;
  const fill = el('span', { class: 'export__fill' });
  const label = el('span', { class: 'export__label', text: 'Export 0%' });
  const done = el('span', { class: 'export__done' }, [tickIcon(), 'Export complete']);
  [fill, label, done].forEach((node) => { ruler.appendChild(node); });
  later(() => {
    [fill, label, done].forEach((node) => { node.remove(); });
    ruler.classList.remove('is-done');
  });
  let pct = -1;
  gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 60%',
      end: 'bottom 60%',
      scrub: 0.4,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = Math.round(self.progress * 100);
        if (p === pct) return;
        pct = p;
        label.textContent = 'Export ' + p + '%';
        ruler.classList.toggle('is-done', p >= 100);
      }
    }
  })
    .fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)
    .fromTo(headEl, { x: 0 }, { x: () => Math.max(0, ruler.clientWidth - 2), ease: 'none' }, 0);
}

/* ---- 8e. About: parallax and tilt on the portrait, a marquee of the service titles ---- */

function initAbout() {
  const gsap = window.gsap;
  const section = $('#about');
  const media = $('#about-media');
  if (!section || section.hidden) return;
  if (media) {
    gsap.fromTo(media, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.5, onToggle: (self) => { media.classList.toggle('is-moving', self.isActive); } } });
    later(() => { media.classList.remove('is-moving'); });
    if (fineMQ.matches) tilt(media, 5);
  }
  const titles = siteData().services.map((s) => text(s && s.title)).filter(Boolean);
  if (!titles.length) return;
  const row = () => {
    return el('span', { class: 'marquee__row' }, titles.map((title) => { return el('span', { class: 'marquee__item' }, [title, el('span', { class: 'rec__dot' })]); }));
  };
  const rows = [row(), row()]; // twice over, so the loop has no seam
  const band = el('div', { class: 'marquee' }, [
    el('ul', { class: 'sr-only', 'aria-label': 'Services' }, titles.map((title) => { return el('li', { text: title }); })),
    el('div', { class: 'marquee__track', 'aria-hidden': 'true' }, rows)
  ]);
  section.parentNode.insertBefore(band, section.nextSibling);
  band.style.setProperty('--m-marquee-dur', Math.max(12, Math.round(rows[0].offsetWidth / 80)) + 's'); // about 80 px a second
  later(whenVisible(band, (visible) => { band.classList.toggle('is-live', visible); }));
  later(() => { band.remove(); });
}

/* ---- 8f. Contact: the display line, export feedback on send, a shake when a field is wrong ---- */

function initContact() {
  const gsap = window.gsap;
  const section = $('#contact');
  const grid = section && $('.contact', section);
  if (!section || section.hidden || !grid) return;

  // "LET'S SHOOT" (marketing copy): the words slide up out of their masks.
  const words = ['Let’s', 'shoot'].map((word) => { return el('span', { class: 'contact__word', text: word }); });
  const line = el('p', { class: 'contact__display' });
  words.forEach((word, i) => {
    if (i) line.appendChild(document.createTextNode(' '));
    line.appendChild(el('span', { class: 'contact__mask' }, word));
  });
  grid.insertBefore(line, grid.firstChild);
  later(() => { line.remove(); });
  onEnter(line, () => { gsap.from(words, { yPercent: 110, duration: 0.8, stagger: 0.14, ease: 'power3.out' }); });

  // main.js has already opened WhatsApp or the email app in this click: this is feedback only.
  on(document, 'contact:send', (event) => {
    const d = event.detail || {};
    const button = (d.submitter && d.submitter.closest && d.submitter.closest('.btn')) || $('#form-actions .btn:not([hidden])');
    if (!button || button.classList.contains('is-exporting')) return;
    const bar = el('span', { class: 'btn__bar' });
    const label = el('span', { class: 'btn__fx-text', text: 'Exporting…' });
    const fx = el('span', { class: 'btn__fx', 'aria-hidden': 'true' }, [bar, label]);
    button.classList.add('is-exporting');
    button.appendChild(fx);
    gsap.timeline({ onComplete: () => { fx.remove(); button.classList.remove('is-exporting'); } })
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power1.inOut' })
      .call(() => {
        label.textContent = '';
        label.appendChild(tickIcon());
        label.appendChild(document.createTextNode('Ready'));
      })
      .to({}, { duration: 1.4 });
  });
  later(() => {
    $$('.btn__fx').forEach((fx) => { fx.remove(); });
    $$('.btn.is-exporting').forEach((b) => { b.classList.remove('is-exporting'); });
  });

  // Validation failed: the fields at fault shake 4 px for 300 ms; main.js's messages are untouched.
  on(document, 'contact:invalid', (event) => {
    const fields = ((event.detail && event.detail.fields) || []).map((id) => document.getElementById(id)).filter(Boolean);
    if (fields.length) gsap.to(fields, { keyframes: { x: [-4, 4, -4, 4, -4, 0], easeEach: 'none' }, duration: 0.3, ease: 'none', onComplete: () => { gsap.set(fields, { clearProps: 'transform' }); } });
  });
}

/* ---- 9. Switch and lifecycle ---- */

/* The browser lands a direct link (#services) before this layer adds layout above it (the film
   strip's pin spacer, the marquee band): settle on it again once the layer is built. */
let anchored = false;

function anchorHash() {
  const node = location.hash.length > 1 ? fragmentTarget(location.hash) : null;
  if (!node || node === document.body || !active) return;
  window.ScrollTrigger.refresh();
  if (lenis) lenis.resize(); // its cached scroll limit is stale, and scrollTo clamps to it
  scrollTo(node, { noFocus: true, immediate: true });
}

function initLifecycle() {
  const ScrollTrigger = window.ScrollTrigger;
  const refresh = () => { if (active) ScrollTrigger.refresh(); };
  on(window, 'pageshow', (event) => { if (event.persisted) refresh(); });
  on(window, 'orientationchange', () => { setTimeout(refresh, 300); });
  on(document, 'work:filter', refresh);
  on(document, 'player:open', () => { if (lenis) lenis.stop(); });
  on(document, 'player:close', () => { if (lenis) lenis.start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  setTimeout(refresh, 0); // main.js built the sections a moment ago: measure once settled
  if (!anchored) { // only the page-load start re-anchors, never the switch
    anchored = true;
    setTimeout(anchorHash, 0);
  }
}

/* ScrollTrigger's own rAF loop runs from registration; it is stopped while motion is off. */
let stOff = false;
function scrollTriggerOn(wanted) {
  const ST = window.ScrollTrigger;
  if (!ST || !libsPresent() || wanted === !stOff) return; // enable() is not idempotent: only after a disable()
  safely('scrolltrigger', () => { if (wanted) ST.enable(); else ST.disable(false, false); });
  stOff = !wanted;
}

let run = 0; // start() number, so a deferred init never runs after stop()

function start() {
  if (active || !motionAllowed()) return;
  active = true;
  scrollTriggerOn(true);
  const id = ++run;
  tier = motionTier();
  root.classList.add('motion-on');
  root.classList.remove('motion-off');
  root.classList.toggle('motion-lite', tier === 'lite');
  const site = siteData();
  // Before the first paint: scroll, hero start states and countdown, the bar (it sizes the hero).
  ctx = window.gsap.context(() => {
    safely('scroll', initScroll);
    safely('hero', () => { initHero(site); });
    safely('timeline bar', initTimeline);
  });
  const rest = () => {
    if (id !== run || !active || !ctx) return;
    ctx.add(() => {
      safely('cursor', initCursor);
      safely('shutter', initShutter);
      safely('work', initWork);
      safely('services', initServices);
      safely('process', initProcess);
      safely('about', initAbout);
      safely('contact', initContact);
      safely('reveals', initReveals);
      safely('lifecycle', initLifecycle);
    });
  };
  window.requestAnimationFrame(() => { setTimeout(rest, 0); });
  started = true;
}

function stop() {
  if (!active) return;
  active = false;
  run += 1;
  cleanups.splice(0).reverse().forEach((fn) => { safely('cleanup', fn); });
  const done = ctx;
  ctx = null;
  if (done) safely('revert', () => { done.revert(); });
  root.classList.remove('motion-on', 'motion-lite', 'has-tl');
  root.classList.add('motion-off');
  scrollTriggerOn(false);
}

/** The hero's pause button becomes the animation switch (main.js still runs the timecode). */
function initSwitch() {
  const toggle = $('#motion-toggle');
  if (!toggle) return;
  // One constant name; aria-pressed carries the state ("Turn animation off, pressed" = it is off).
  const label = () => {
    toggle.setAttribute('aria-label', 'Turn animation off');
    toggle.setAttribute('aria-pressed', off ? 'true' : 'false');
  };
  const apply = () => {
    if (off || reduceMQ.matches) stop();
    else start();
    root.classList.toggle('motion-off', !active);
  };
  label();
  // main.js's own click handler (registered first) stores the choice; this one applies it.
  toggle.addEventListener('click', () => {
    off = !off;
    root.classList.add('motion-switched'); // the foundation's CSS entrance must not replay
    label();
    apply();
  });
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', apply);
  else if (reduceMQ.addListener) reduceMQ.addListener(apply);
}

window.SiteMotion = {
  allowed: motionAllowed,
  tier: motionTier,
  active: () => active,
  start: start,
  stop: stop,
  scrollTo: scrollTo,
  refresh: () => { if (active) window.ScrollTrigger.refresh(); },
  lenis: () => lenis
};

function boot() {
  safely('switch', initSwitch);
  const go = () => {
    safely('grade slider', initGrade);
    safely('start', start);
    started = true; // whether or not motion ran: the switch must never bring the countdown
    root.classList.toggle('motion-off', !active);
    if (!active) scrollTriggerOn(false);
  };
  if (window.SITE_RENDERED) go();
  else {
    root.classList.add('motion-off');
    document.addEventListener('site:rendered', go, { once: true });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
