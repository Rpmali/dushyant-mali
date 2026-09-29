/* =====================================================================
   main.js: builds the page from window.SITE (assets/js/content.js).
   You should not need to edit this file to change your details.

   Safety rules followed throughout:
   - Text from content.js is only ever placed with textContent, never
     as HTML, so it cannot inject code.
   - Links from content.js are accepted only if they are http(s),
     mailto or tel. Anything else (for example javascript:) is dropped.
   - Nothing is loaded from YouTube or Vimeo until a video is clicked.
   ===================================================================== */
(function () {
  'use strict';

  /* -------------------------------------------------------------------
     1. Small pure helpers (no page access). Also exported for tests.
     ------------------------------------------------------------------- */

  const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  const VIMEO_ID = /^[0-9]{6,12}$/;
  const VIMEO_HASH = /^[0-9a-f]{6,24}$/i;
  const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
  const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|$)/i;
  const YOUTUBE_HOSTS = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'];
  const YOUTUBE_PATHS = ['shorts', 'embed', 'live', 'v', 'e'];
  const VIMEO_NON_VIDEO = ['showcase', 'album', 'user', 'categories', 'search', 'upload', 'settings', 'blog'];

  /** Turn any value into a trimmed string ('' for empty, objects, booleans). */
  function text(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return '';
  }

  /** Parse an http(s) address. Accepts "www.example.com/x" by adding https://. */
  function toHttpUrl(value) {
    let s = text(value);
    if (!s || /\s/.test(s)) return null;
    if (s.slice(0, 2) === '//') {
      s = 'https:' + s;
    } else if (!SCHEME.test(s)) {
      if (!BARE_DOMAIN.test(s)) return null;
      s = 'https://' + s;
    }
    let url;
    try {
      url = new URL(s);
    } catch (e) {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url;
  }

  function vimeoResult(id, hash) {
    if (!VIMEO_ID.test(id || '')) return null;
    return { provider: 'vimeo', id: id, hash: VIMEO_HASH.test(hash || '') ? hash : '' };
  }

  /**
   * Read a YouTube or Vimeo link (or bare ID).
   * Returns { provider: 'youtube', id } or { provider: 'vimeo', id, hash } or null.
   */
  function parseVideo(value) {
    const s = text(value);
    if (!s) return null;
    if (/^[0-9]+$/.test(s)) return vimeoResult(s, '');
    if (YOUTUBE_ID.test(s)) return { provider: 'youtube', id: s };

    const url = toHttpUrl(s);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' || YOUTUBE_HOSTS.indexOf(host) !== -1) {
      let id = '';
      if (host === 'youtu.be') id = parts[0] || '';
      else if (parts[0] === 'watch' || parts.length === 0) id = url.searchParams.get('v') || '';
      else if (YOUTUBE_PATHS.indexOf(parts[0]) !== -1) id = parts[1] || '';
      return YOUTUBE_ID.test(id) ? { provider: 'youtube', id: id } : null;
    }

    if (host === 'vimeo.com') {
      if (VIMEO_NON_VIDEO.indexOf((parts[0] || '').toLowerCase()) !== -1) return null;
      for (let i = 0; i < parts.length; i += 1) {
        if (/^[0-9]+$/.test(parts[i])) {
          return vimeoResult(parts[i], parts[i + 1] || url.searchParams.get('h') || '');
        }
      }
      return null;
    }

    if (host === 'player.vimeo.com' && parts[0] === 'video') {
      return vimeoResult(parts[1], url.searchParams.get('h') || '');
    }
    return null;
  }

  function embedUrl(video) {
    if (video.provider === 'youtube') {
      return 'https://www.youtube-nocookie.com/embed/' + video.id + '?autoplay=1&rel=0&modestbranding=1';
    }
    return 'https://player.vimeo.com/video/' + video.id + '?autoplay=1' + (video.hash ? '&h=' + video.hash : '');
  }

  function watchUrl(video) {
    if (video.provider === 'youtube') return 'https://www.youtube.com/watch?v=' + video.id;
    return 'https://vimeo.com/' + video.id + (video.hash ? '/' + video.hash : '');
  }

  function thumbnailUrl(video) {
    return video.provider === 'youtube' ? 'https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg' : '';
  }

  /**
   * A picture path from content.js: a relative path inside the site
   * ("assets/img/me.jpg") or a full https address. Returns '' if unusable.
   */
  function assetSrc(value) {
    const s = text(value);
    if (!s || /["'<>\\`]/.test(s)) return '';
    if (/^https:\/\//i.test(s)) {
      const url = toHttpUrl(s);
      return url ? url.href : '';
    }
    if (SCHEME.test(s) || s.slice(0, 2) === '//') return '';
    // A leading "/" would point outside the project on GitHub Pages; drop it.
    return s.replace(/^\/+/, '');
  }

  const EMAIL = /^[^\s@<>()[\]\\,;:"'?&#%/]+@[^\s@<>()[\]\\,;:"'?&#%/]+\.[a-z]{2,}$/i;

  function parseEmail(value) {
    const s = text(value).replace(/^mailto:/i, '');
    return EMAIL.test(s) ? s : '';
  }

  /**
   * WhatsApp needs the full international number as digits only.
   * "+91 98765 43210", "091-98765-43210", "0091 98765 43210" -> "919876543210".
   * A bare 10-digit Indian mobile number gets +91 added (assumed: true).
   * Only phone characters are accepted: words, hours or an extension after the
   * number would otherwise be read as extra digits and dial a stranger.
   * An Indian trunk zero written after the country code ("+91 0 98765...")
   * is removed (trunkZero: true) so the owner can be told about it.
   */
  function parseWhatsApp(value) {
    const s = text(value);
    const none = { digits: '', display: '', assumed: false, trunkZero: false };
    if (!s || !/^\+?[0-9()\s.-]+$/.test(s)) return none;
    let digits = s.replace(/\D/g, '');
    let assumed = false;
    let trunkZero = false;
    if (s.charAt(0) !== '+') {
      if (digits.slice(0, 2) === '00') digits = digits.slice(2);
      else if (digits.charAt(0) === '0') digits = digits.slice(1);
      if (/^[6-9][0-9]{9}$/.test(digits)) {
        digits = '91' + digits;
        assumed = true;
      }
    }
    if (/^910[6-9][0-9]{9}$/.test(digits)) {
      digits = '91' + digits.slice(3);
      trunkZero = true;
    }
    if (!/^[1-9][0-9]{7,14}$/.test(digits)) return none;
    let display = '+' + digits;
    if (/^91[6-9][0-9]{9}$/.test(digits)) display = '+91 ' + digits.slice(2, 7) + ' ' + digits.slice(7);
    else if (s.charAt(0) === '+') display = s;
    return { digits: digits, display: display, assumed: assumed, trunkZero: trunkZero };
  }

  function parsePhone(value) {
    const s = text(value);
    if (!s || !/^[+0-9()\s.-]+$/.test(s)) return null;
    const digits = s.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 15) return null;
    return { display: s, href: 'tel:' + (s.charAt(0) === '+' ? '+' : '') + digits };
  }

  const INSTAGRAM_RESERVED = ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'tv', 'direct'];

  function parseInstagram(value) {
    let s = text(value);
    if (!s) return null;
    if (/instagram\.com/i.test(s)) {
      const url = toHttpUrl(s);
      if (!url) return null;
      const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
      const parts = url.pathname.split('/').filter(Boolean);
      if (host !== 'instagram.com' || parts.length !== 1) return null;
      s = parts[0];
    }
    s = s.replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) return null;
    if (INSTAGRAM_RESERVED.indexOf(s.toLowerCase()) !== -1) return null;
    return { handle: s, url: 'https://www.instagram.com/' + s + '/' };
  }

  function parseYouTubeChannel(value) {
    const s = text(value);
    if (!s) return null;
    if (/^@[A-Za-z0-9._-]{3,30}$/.test(s)) {
      return { url: 'https://www.youtube.com/' + s, label: s };
    }
    const url = toHttpUrl(s);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    if (host !== 'youtube.com') return null;
    url.protocol = 'https:';
    const first = url.pathname.split('/').filter(Boolean)[0] || '';
    let label = 'YouTube channel';
    if (first.charAt(0) === '@') {
      try {
        label = decodeURIComponent(first);
      } catch (e) {
        label = first;
      }
    }
    return { url: url.href, label: label };
  }

  /**
   * "Videographer, Video Editor & Social Media Marketer" ->
   * "videographer, video editor & social media marketer". Keeps acronyms
   * such as DOP; a word may carry trailing punctuation ("Videographer,").
   */
  function sentenceCase(phrase) {
    return phrase
      .split(/(\s+)/)
      .map(function (word) {
        return /^[A-Z][a-z’'-]*[,.;:!?]?$/.test(word) ? word.toLowerCase() : word;
      })
      .join('');
  }

  function initials(name) {
    const words = text(name).split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const first = words[0].charAt(0);
    const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  function pad(n, size) {
    let s = String(n);
    while (s.length < (size || 2)) s = '0' + s;
    return s;
  }

  /** Frame count -> HH:MM:SS:FF */
  function timecode(frames, fps) {
    const f = frames % fps;
    const totalSeconds = Math.floor(frames / fps);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600) % 100;
    return pad(h) + ':' + pad(m) + ':' + pad(s) + ':' + pad(f);
  }

  /** "2026-10-12" -> "12 October 2026" (read as a local date, never shifted by time zone). */
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(iso));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    try {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return m[3] + '-' + m[2] + '-' + m[1];
    }
  }

  /** The message that is pre-filled in WhatsApp or the email app. */
  function buildMessage(data) {
    const lines = [];
    lines.push('Hi ' + (data.ownerFirstName || 'there') + ',');
    lines.push('');
    lines.push('My name is ' + data.name + '.');
    if (data.type) lines.push('Project: ' + data.type);
    if (data.date) lines.push('Preferred date: ' + data.date);
    lines.push('');
    lines.push(data.message);
    return lines.join('\n');
  }

  const helpers = {
    text: text,
    toHttpUrl: toHttpUrl,
    parseVideo: parseVideo,
    embedUrl: embedUrl,
    watchUrl: watchUrl,
    thumbnailUrl: thumbnailUrl,
    assetSrc: assetSrc,
    parseEmail: parseEmail,
    parseWhatsApp: parseWhatsApp,
    parsePhone: parsePhone,
    parseInstagram: parseInstagram,
    parseYouTubeChannel: parseYouTubeChannel,
    sentenceCase: sentenceCase,
    initials: initials,
    timecode: timecode,
    formatDate: formatDate,
    buildMessage: buildMessage
  };

  // Outside a browser (for example a test runner), only export the helpers.
  if (typeof document === 'undefined') {
    if (typeof module === 'object' && module.exports) module.exports = helpers;
    return;
  }

  /* -------------------------------------------------------------------
     2. Page helpers
     ------------------------------------------------------------------- */

  const root = document.documentElement;
  const notes = [];
  let notesReady = false;
  let notesList = null;
  const reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /** Note a problem in content.js: console always, on-screen only in local preview. */
  function warn(message) {
    notes.push(message);
    if (window.console && console.warn) console.warn('[site] ' + message);
    if (notesReady) addPreviewNote(message); // e.g. a picture that failed after the page was built
  }

  /** Create an element. Strings in children become text, never HTML. */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        const value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value === true ? '' : String(value));
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined || children === false) return node;
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child === null || child === undefined || child === false || child === '') return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FILLED = { fill: 'currentColor', stroke: 'none' };

  function withFill(attrs) {
    return Object.assign({}, attrs, FILLED);
  }

  const ICONS = {
    play: [['path', withFill({ d: 'M8 5.5v13l10.5-6.5z' })]],
    external: [['path', { d: 'M14 5h5v5M19 5l-8.5 8.5M17 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5' }]],
    arrowRight: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
    mail: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['path', { d: 'M3.5 6.5 12 13l8.5-6.5' }]],
    phone: [['path', { d: 'M6.6 3.5h2.6l1.6 4.2-2 1.3a10.8 10.8 0 0 0 6.2 6.2l1.3-2 4.2 1.6v2.6a1.6 1.6 0 0 1-1.7 1.6C11.1 18.5 5.5 12.9 5 5.2a1.6 1.6 0 0 1 1.6-1.7z' }]],
    whatsapp: [
      ['path', { d: 'M4.5 19.5l1.2-3.6a8 8 0 1 1 2.9 2.6z' }],
      ['path', withFill({ d: 'M9.3 8.4c.3-.6 1.1-.6 1.3 0l.5 1.3c.1.3 0 .6-.2.8l-.4.4a5.3 5.3 0 0 0 2.6 2.6l.4-.4c.2-.2.5-.3.8-.2l1.3.5c.6.2.6 1 0 1.3-.6.3-1.6.6-3.1-.2a7.2 7.2 0 0 1-3-3c-.8-1.5-.5-2.5-.2-3.1z' })]
    ],
    instagram: [
      ['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 5 }],
      ['circle', { cx: 12, cy: 12, r: 3.8 }],
      ['circle', withFill({ cx: 17, cy: 7, r: 1 })]
    ],
    youtube: [
      ['rect', { x: 2.5, y: 5.5, width: 19, height: 13, rx: 4 }],
      ['path', withFill({ d: 'M10.2 9.2v5.6l4.8-2.8z' })]
    ],
    pin: [['path', { d: 'M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z' }], ['circle', { cx: 12, cy: 10, r: 2.4 }]],
    camera: [['rect', { x: 2.5, y: 6.5, width: 13, height: 11, rx: 2 }], ['path', { d: 'M15.5 10.5l6-3.5v10l-6-3.5z' }]],
    scissors: [
      ['circle', { cx: 6, cy: 6, r: 3 }],
      ['circle', { cx: 6, cy: 18, r: 3 }],
      ['path', { d: 'M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12' }]
    ],
    grade: [['circle', { cx: 9, cy: 9.5, r: 5.5 }], ['circle', { cx: 15, cy: 9.5, r: 5.5 }], ['circle', { cx: 12, cy: 14.5, r: 5.5 }]],
    vertical: [['rect', { x: 7, y: 2.5, width: 10, height: 19, rx: 2.5 }], ['path', withFill({ d: 'M10.8 9.6v4.8l4-2.4z' })]],
    /* Speech bubble with three dots: social media accounts and community. */
    social: [
      ['path', { d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z' }],
      ['circle', withFill({ cx: 8.5, cy: 10, r: 1 })],
      ['circle', withFill({ cx: 12, cy: 10, r: 1 })],
      ['circle', withFill({ cx: 15.5, cy: 10, r: 1 })]
    ],
    /* Megaphone: ads and campaigns. */
    megaphone: [
      ['path', { d: 'M4 10.5v3a1 1 0 0 0 1 1h2.5l9.5 4V5.5l-9.5 4H5a1 1 0 0 0-1 1z' }],
      ['path', { d: 'M8 14.5v3a1.5 1.5 0 0 0 3 0v-2.2' }],
      ['path', { d: 'M20 9.5a3.2 3.2 0 0 1 0 5' }]
    ],
    clapper: [
      ['rect', { x: 3.5, y: 10, width: 17, height: 10, rx: 1.5 }],
      ['path', { d: 'M3.5 10 3 6.2 19.3 3.6l.6 3.8zM8.3 5.4l2.3 3.3M13.6 4.5l2.3 3.3' }]
    ]
  };

  function icon(name, extraClass) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (extraClass ? ' ' + extraClass : ''));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (ICONS[name] || []).forEach(function (part) {
      const shape = document.createElementNS(SVG_NS, part[0]);
      Object.keys(part[1]).forEach(function (key) {
        shape.setAttribute(key, String(part[1][key]));
      });
      svg.appendChild(shape);
    });
    return svg;
  }

  function vfFrame(extraClass) {
    return el('span', { class: 'vf-frame ' + extraClass, 'aria-hidden': 'true' });
  }

  /** Open a URL the same way a link click would (new tab for web pages). */
  function openExternal(href, newTab) {
    const a = el('a', { href: href, hidden: true });
    if (newTab) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function isLocalPreview() {
    const host = location.hostname;
    return location.protocol === 'file:' || host === '' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function hideSection(id) {
    const section = document.getElementById(id);
    if (section) section.hidden = true;
    $$('.site-nav a[href="#' + id + '"]').forEach(function (a) {
      if (a.parentElement) a.parentElement.hidden = true;
    });
  }

  /* -------------------------------------------------------------------
     3. Read content.js
     ------------------------------------------------------------------- */

  function list(value) {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  }

  function objects(value, field) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      warn(field + ' should be a list inside [ and ], so it was ignored.');
      return [];
    }
    return value;
  }

  function readSite() {
    const raw = window.SITE;
    const loaded = !!raw && typeof raw === 'object';
    const s = loaded ? raw : {};
    const contact = s.contact && typeof s.contact === 'object' ? s.contact : {};
    const reel = s.showreel && typeof s.showreel === 'object' ? s.showreel : {};
    const staticName = text($('.hero__title') && $('.hero__title').textContent);
    const staticRole = text($('.hero__role') && $('.hero__role').textContent);

    return {
      loaded: loaded,
      name: text(s.name) || staticName,
      role: text(s.role) || staticRole,
      tagline: text(s.tagline),
      location: text(s.location),
      availability: text(s.availability),
      about: list(s.about),
      photo: text(s.photo),
      contact: contact,
      showreel: { video: text(reel.video), poster: text(reel.poster) },
      services: objects(s.services, 'services')
        .filter(function (x) { return x && typeof x === 'object'; })
        .map(function (x) {
          return { title: text(x.title), description: text(x.description), points: list(x.points) };
        })
        .filter(function (x) { return x.title; }),
      process: objects(s.process, 'process')
        .filter(function (x) { return x && typeof x === 'object'; })
        .map(function (x) { return { title: text(x.title), text: text(x.text) }; })
        .filter(function (x) { return x.title || x.text; }),
      projects: objects(s.projects, 'projects')
    };
  }

  /* -------------------------------------------------------------------
     4. Sections
     ------------------------------------------------------------------- */

  function renderIdentity(site) {
    $$('[data-site="name"]').forEach(function (node) { node.textContent = site.name; });
    $$('[data-site="role"]').forEach(function (node) { node.textContent = site.role; });
    if (site.name) document.title = site.name + (site.role ? ' | ' + site.role : '');
  }

  function renderHero(site) {
    const tagline = $('#hero-tagline');
    if (site.tagline) {
      tagline.textContent = site.tagline;
      tagline.hidden = false;
    }

    const chips = $('#hero-chips');
    if (site.location) {
      chips.appendChild(el('li', { class: 'chip' }, [icon('pin'), el('span', { class: 'sr-only', text: 'Based in ' }), site.location]));
    }
    if (site.availability) {
      chips.appendChild(el('li', { class: 'chip' }, [el('span', { class: 'chip__dot', 'aria-hidden': 'true' }), site.availability]));
    }
    chips.hidden = !chips.children.length;

    const reelButton = $('#showreel-button');
    if (site.showreel.video) {
      const video = parseVideo(site.showreel.video);
      if (video) {
        reelButton.hidden = false;
        reelButton.addEventListener('click', function () {
          openPlayer({ title: 'Showreel', video: video }, reelButton);
        });
      } else {
        warn('showreel.video "' + site.showreel.video + '" is not a YouTube or Vimeo link, so the "Play showreel" button is hidden.');
      }
    }

    if (site.showreel.poster) {
      const src = assetSrc(site.showreel.poster);
      const poster = $('#hero-poster');
      if (src) {
        poster.addEventListener('error', function () {
          poster.hidden = true;
          $('#hero').classList.remove('hero--has-poster');
          warn('showreel.poster "' + site.showreel.poster + '" could not be loaded. Check the file name and folder.');
        });
        poster.src = src;
        poster.hidden = false;
        $('#hero').classList.add('hero--has-poster');
      } else {
        warn('showreel.poster "' + site.showreel.poster + '" is not a usable picture path (use e.g. "assets/img/poster.jpg").');
      }
    }
  }

  /* ---- Work ---- */

  function hashIndex(value, size) {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h % size;
  }

  function readProjects(raw) {
    const items = [];
    raw.forEach(function (p, i) {
      const where = 'Project ' + (i + 1);
      if (!p || typeof p !== 'object') {
        warn(where + ' is not written as a { ... } block, so it was skipped.');
        return;
      }
      const title = text(p.title);
      const label = where + (title ? ' ("' + title + '")' : '');
      const videoRaw = text(p.video);
      const linkRaw = text(p.link);
      const video = videoRaw ? parseVideo(videoRaw) : null;
      const linkUrl = linkRaw ? toHttpUrl(linkRaw) : null;

      if (linkRaw && !linkUrl) {
        warn(label + ': the link "' + linkRaw + '" is not a full web address starting with https://, so it was ignored.');
      }
      if (videoRaw && !video) {
        warn(linkUrl
          ? label + ': the video "' + videoRaw + '" is not a YouTube or Vimeo link, so the card opens its link instead.'
          : label + ' was skipped: the video "' + videoRaw + '" is not a YouTube or Vimeo link or ID, and there is no link to use instead.');
      }
      if (!video && !linkUrl) {
        if (!videoRaw && !linkRaw) warn(label + ' was skipped: it has no video or link.');
        return;
      }

      // "Music  Video" and "Music Video" are the same category, not two filter buttons.
      const category = text(p.category).replace(/\s+/g, ' ');
      if (!title) warn(where + ' has no title; its category is shown instead.');
      items.push({
        index: i,
        title: title || category || 'Video',
        category: category,
        categoryKey: category.toLowerCase(),
        year: text(p.year),
        client: text(p.client),
        role: text(p.role),
        description: text(p.description),
        thumbnail: text(p.thumbnail),
        featured: p.featured === true,
        video: video,
        link: video ? '' : linkUrl.href,
        linkHost: linkUrl ? linkUrl.hostname.replace(/^www\./, '') : ''
      });
    });

    // Featured first, otherwise keep the order from content.js.
    items.sort(function (a, b) {
      return (Number(b.featured) - Number(a.featured)) || (a.index - b.index);
    });
    return items;
  }

  function buildMedia(item) {
    const media = el('div', { class: 'card__media' });
    media.appendChild(el('div', { class: 'card__fallback card__fallback--' + hashIndex(item.title, 4), 'aria-hidden': 'true' }, [
      item.category ? el('span', { class: 'card__fallback-cat', text: item.category }) : null,
      el('span', { class: 'card__fallback-title', text: item.title })
    ]));

    let src = '';
    let fromYouTube = false;
    if (item.thumbnail) {
      src = assetSrc(item.thumbnail);
      if (!src) warn('"' + item.title + '": thumbnail "' + item.thumbnail + '" is not a usable picture path, so it was ignored.');
    }
    if (!src && item.video && item.video.provider === 'youtube') {
      src = thumbnailUrl(item.video);
      fromYouTube = true;
    }
    if (src) {
      const img = el('img', { class: 'card__img', alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 360 });
      img.addEventListener('error', function () {
        img.remove();
        if (!fromYouTube) warn('"' + item.title + '": thumbnail "' + item.thumbnail + '" could not be loaded. Check the file name and folder.');
      });
      if (fromYouTube) {
        // Missing YouTube videos return a tiny grey placeholder instead of an error.
        img.addEventListener('load', function () {
          if (img.naturalWidth > 0 && img.naturalWidth <= 120) img.remove();
        });
      }
      img.src = src;
      media.appendChild(img);
    }

    media.appendChild(vfFrame('card__vf'));
    media.appendChild(el('span', { class: 'card__badge ' + (item.video ? 'card__badge--play' : 'card__badge--link'), 'aria-hidden': 'true' },
      icon(item.video ? 'play' : 'external')));
    return media;
  }

  function buildCard(item, position) {
    let action;
    if (item.video) {
      action = el('button', { type: 'button', class: 'card__action' }, [el('span', { class: 'sr-only', text: 'Play video: ' }), item.title]);
      action.addEventListener('click', function () {
        openPlayer(item, action);
      });
    } else {
      action = el('a', { class: 'card__action', href: item.link, target: '_blank', rel: 'noopener noreferrer' },
        [item.title, el('span', { class: 'sr-only', text: ' (opens ' + item.linkHost + ' in a new tab)' })]);
    }

    const meta = [];
    if (item.category) meta.push(el('span', { text: item.category }));
    if (item.year) meta.push(el('span', { text: item.year }));
    if (!item.video && item.linkHost) meta.push(el('span', { text: item.linkHost }));

    let credit = '';
    if (item.role && item.client) credit = item.role + ' for ' + item.client;
    else if (item.role) credit = item.role;
    else if (item.client) credit = 'For ' + item.client;

    const li = el('li', { class: 'work-grid__item', 'data-category': item.categoryKey, 'data-reveal': true }, el('article', { class: 'card' }, [
      buildMedia(item),
      el('div', { class: 'card__body' }, [
        el('h3', { class: 'card__title' }, action),
        meta.length ? el('p', { class: 'card__meta' }, meta) : null,
        credit ? el('p', { class: 'card__credit', text: credit }) : null,
        item.description ? el('p', { class: 'card__desc', text: item.description }) : null
      ])
    ]));
    li.style.setProperty('--reveal-delay', ((position % 3) * 90) + 'ms');
    return li;
  }

  function renderFilters(items, cards) {
    const container = $('#work-filters');
    const status = $('#work-status');
    const categories = [];
    const seen = {};
    items.slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (item) {
      if (!item.categoryKey) return;
      if (!seen[item.categoryKey]) {
        seen[item.categoryKey] = { key: item.categoryKey, label: item.category, count: 0 };
        categories.push(seen[item.categoryKey]);
      }
      seen[item.categoryKey].count += 1;
    });
    if (categories.length < 2) return; // One category needs no filter.

    const options = [{ key: '*', label: 'All', count: items.length }].concat(categories);
    const buttons = options.map(function (option) {
      const button = el('button', { type: 'button', class: 'filter', 'aria-pressed': option.key === '*' ? 'true' : 'false' }, [
        option.label,
        el('span', { class: 'filter__count', 'aria-hidden': 'true', text: String(option.count) })
      ]);
      button.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === button ? 'true' : 'false'); });
        let shown = 0;
        cards.forEach(function (card) {
          const match = option.key === '*' || card.getAttribute('data-category') === option.key;
          card.hidden = !match;
          if (match) {
            shown += 1;
            card.classList.add('is-visible');
          }
        });
        status.textContent = option.key === '*'
          ? 'Showing all ' + shown + ' projects.'
          : 'Showing ' + shown + ' ' + option.label + (shown === 1 ? ' project.' : ' projects.');
      });
      return button;
    });
    append(container, buttons);
    container.hidden = false;
  }

  function renderWork(site, links) {
    const items = readProjects(site.projects);
    const grid = $('#work-grid');

    if (!items.length) {
      const actions = [el('a', { class: 'btn btn--primary', href: '#contact', text: 'Get in touch' })];
      if (links.instagram) {
        actions.push(el('a', { class: 'btn btn--ghost', href: links.instagram.url, target: '_blank', rel: 'noopener noreferrer' },
          [icon('instagram'), 'Instagram', el('span', { class: 'sr-only', text: ' (opens in a new tab)' })]));
      }
      if (links.youtube) {
        actions.push(el('a', { class: 'btn btn--ghost', href: links.youtube.url, target: '_blank', rel: 'noopener noreferrer' },
          [icon('youtube'), 'YouTube', el('span', { class: 'sr-only', text: ' (opens in a new tab)' })]));
      }
      const empty = $('#work-empty');
      empty.appendChild(el('div', { class: 'empty__panel', 'data-reveal': true }, [
        vfFrame('empty__vf'),
        el('p', { class: 'empty__hud', 'aria-hidden': 'true' }, [el('span', { class: 'rec__dot' }), 'Standby']),
        el('div', { class: 'empty__body' }, [
          el('h3', { class: 'empty__title', text: 'New work is being added' }),
          el('p', {
            class: 'empty__text',
            text: 'Recent films and edits will appear here soon. In the meantime, get in touch to talk about your project.'
          }),
          el('div', { class: 'empty__actions' }, actions)
        ])
      ]));
      empty.hidden = false;
      return;
    }

    const cards = items.map(buildCard);
    append(grid, cards);
    grid.hidden = false;
    renderFilters(items, cards);
  }

  /* ---- Services and process ---- */

  /** Pick an icon from words in the service title; each shipped service gets its own. */
  function serviceIcon(title) {
    const t = title.toLowerCase();
    if (/\bads?\b|advert|campaign|paid|promot/.test(t)) return 'megaphone';
    if (/social|manage|account|community/.test(t)) return 'social';
    if (/reel|short|vertical/.test(t)) return 'vertical';
    if (/colou?r|grad/.test(t)) return 'grade';
    if (/edit|cut|post/.test(t)) return 'scissors';
    if (/shoot|film|camera|record|cover|videograph|cinemat/.test(t)) return 'camera';
    return 'clapper';
  }

  function renderServices(site) {
    if (!site.services.length) {
      hideSection('services');
      return;
    }
    const listEl = $('#services-list');
    site.services.forEach(function (service, i) {
      const li = el('li', { class: 'service', 'data-reveal': true }, [
        el('span', { class: 'service__num', 'aria-hidden': 'true', text: pad(i + 1) }),
        icon(serviceIcon(service.title), 'service__icon'),
        el('h3', { class: 'service__title', text: service.title }),
        service.description ? el('p', { class: 'service__desc', text: service.description }) : null,
        service.points.length
          ? el('ul', { class: 'service__points' }, service.points.map(function (point) { return el('li', { text: point }); }))
          : null
      ]);
      li.style.setProperty('--reveal-delay', ((i % 4) * 80) + 'ms');
      listEl.appendChild(li);
    });
  }

  function renderProcess(site) {
    if (!site.process.length) {
      hideSection('process');
      return;
    }
    const listEl = $('#process-list');
    site.process.forEach(function (step, i) {
      const li = el('li', { class: 'step', 'data-reveal': true }, [
        el('span', { class: 'step__num', 'aria-hidden': 'true', text: pad(i + 1) }),
        step.title ? el('h3', { class: 'step__title', text: step.title }) : null,
        step.text ? el('p', { class: 'step__text', text: step.text }) : null
      ]);
      li.style.setProperty('--reveal-delay', ((i % 4) * 110) + 'ms');
      listEl.appendChild(li);
    });
  }

  /* ---- About ---- */

  function monogram(site) {
    return el('div', { class: 'monogram', 'aria-hidden': 'true' }, [
      el('span', { class: 'monogram__rec' }, [el('span', { class: 'rec__dot' }), 'REC']),
      el('span', { class: 'monogram__letters', text: initials(site.name) })
    ]);
  }

  function renderAbout(site) {
    const media = $('#about-media');
    const src = assetSrc(site.photo);
    if (site.photo && !src) warn('photo "' + site.photo + '" is not a usable picture path (use e.g. "assets/img/profile.jpg").');
    if (src) {
      const img = el('img', { class: 'about__photo', alt: site.name, loading: 'lazy', decoding: 'async', width: 800, height: 1000 });
      img.addEventListener('error', function () {
        warn('photo "' + site.photo + '" could not be loaded. Check the file name and folder.');
        img.replaceWith(monogram(site));
      });
      img.src = src;
      media.appendChild(img);
    } else {
      media.appendChild(monogram(site));
    }
    media.appendChild(vfFrame('about__vf'));

    const body = $('#about-text');
    if (site.about.length) {
      site.about.forEach(function (paragraph, i) {
        body.appendChild(el('p', { class: i === 0 ? 'about__lead' : null, text: paragraph }));
      });
    } else if (site.role) {
      // No biography yet: one plain line built only from the name and role.
      const role = sentenceCase(site.role);
      body.appendChild(el('p', { class: 'about__lead', text: site.name + ' is a freelance ' + role + '.' }));
    }
    body.appendChild(el('p', null, el('a', { class: 'text-link', href: '#contact' }, ['Talk about your project', icon('arrowRight')])));
  }

  /* ---- Contact ---- */

  function readContact(raw) {
    const c = raw || {};
    const out = {};

    out.email = parseEmail(c.email);
    if (text(c.email) && !out.email) warn('contact.email "' + text(c.email) + '" does not look like an email address, so it is hidden.');

    const wa = parseWhatsApp(c.whatsapp);
    out.whatsapp = wa.digits ? wa : null;
    if (text(c.whatsapp) && !wa.digits) warn('contact.whatsapp "' + text(c.whatsapp) + '" is not a full phone number, so WhatsApp is hidden. Write only the number, like "+91 98765 43210" (no words, hours or extension).');
    if (wa.assumed) warn('contact.whatsapp has no country code, so +91 (India) was added. Write it as "' + wa.display + '" to remove this note.');
    if (wa.trunkZero) warn('contact.whatsapp has an extra 0 after +91, which was removed. Write it as "' + wa.display + '" to remove this note.');

    out.phone = parsePhone(c.phone);
    if (text(c.phone) && !out.phone) warn('contact.phone "' + text(c.phone) + '" is not a phone number, so it is hidden.');

    out.instagram = parseInstagram(c.instagram);
    if (text(c.instagram) && !out.instagram) warn('contact.instagram "' + text(c.instagram) + '" is not an Instagram username or profile link, so it is hidden.');

    out.youtube = parseYouTubeChannel(c.youtube);
    if (text(c.youtube) && !out.youtube) warn('contact.youtube "' + text(c.youtube) + '" is not a YouTube channel link, so it is hidden.');

    const directory = [];
    if (out.email) directory.push({ key: 'email', icon: 'mail', label: 'Email', value: out.email, href: 'mailto:' + out.email });
    if (out.whatsapp) directory.push({ key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', value: out.whatsapp.display, href: 'https://wa.me/' + out.whatsapp.digits, external: true });
    if (out.phone) directory.push({ key: 'phone', icon: 'phone', label: 'Phone', value: out.phone.display, href: out.phone.href });
    if (out.instagram) directory.push({ key: 'instagram', icon: 'instagram', label: 'Instagram', value: '@' + out.instagram.handle, href: out.instagram.url, external: true });
    if (out.youtube) directory.push({ key: 'youtube', icon: 'youtube', label: 'YouTube', value: out.youtube.label, href: out.youtube.url, external: true });
    out.directory = directory;
    return out;
  }

  function externalAttrs(entry) {
    return entry.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  }

  function renderContact(site, contact) {
    const lead = $('#contact-lead');
    const canWhatsApp = !!contact.whatsapp;
    const canEmail = !!contact.email;

    // "Project" covers a shoot, an edit or a campaign: the form's list offers all of them.
    if (canWhatsApp && canEmail) lead.textContent = 'Tell me about your project. Your message opens in WhatsApp or your email app, ready to send.';
    else if (canWhatsApp) lead.textContent = 'Tell me about your project. Your message opens in WhatsApp, ready to send.';
    else if (canEmail) lead.textContent = 'Tell me about your project. Your message opens in your email app, ready to send.';
    else if (contact.directory.length) lead.textContent = 'Get in touch using any of the details below.';
    else lead.textContent = 'Contact details are coming soon. Please check back shortly.';
    lead.hidden = false;

    if (contact.directory.length) {
      const direct = $('#contact-direct');
      if (!canWhatsApp && !canEmail) $('#contact-direct-title').textContent = 'Contact details';
      append($('#contact-links'), contact.directory.map(function (entry) {
        const attrs = Object.assign({ class: 'contact-link', href: entry.href }, externalAttrs(entry));
        return el('li', null, el('a', attrs, [
          el('span', { class: 'contact-link__icon' }, icon(entry.icon)),
          el('span', { class: 'contact-link__text' }, [
            el('span', { class: 'contact-link__label', text: entry.label }),
            el('span', { class: 'contact-link__value', text: entry.value }),
            entry.external ? el('span', { class: 'sr-only', text: ' (opens in a new tab)' }) : null
          ])
        ]));
      }));
      direct.hidden = false;
    }

    if (!canWhatsApp && !canEmail) return; // No dead form: nothing to send it with.
    setupForm(site, contact);
    $('#contact-panel').hidden = false;
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function setupForm(site, contact) {
    const form = $('#contact-form');
    const status = $('#form-status');
    const nameInput = $('#f-name');
    const typeInput = $('#f-type');
    const dateInput = $('#f-date');
    const messageInput = $('#f-message');
    const waButton = $('#send-whatsapp');
    const emailButton = $('#send-email');
    const ownerFirstName = site.name.split(/\s+/)[0] || '';

    // Project types come from the services list, plus a catch-all.
    if (site.services.length) {
      site.services.forEach(function (service) {
        typeInput.appendChild(el('option', { value: service.title, text: service.title }));
      });
      typeInput.appendChild(el('option', { value: 'Something else', text: 'Something else' }));
    } else {
      typeInput.required = false;
      typeInput.closest('.field').remove();
    }

    dateInput.min = todayIso();

    // Only the buttons that can actually send are kept on the page.
    if (contact.whatsapp) {
      waButton.hidden = false;
      waButton.insertBefore(icon('whatsapp'), waButton.firstChild);
    } else {
      waButton.remove();
    }
    if (contact.email) {
      emailButton.hidden = false;
      emailButton.insertBefore(icon('mail'), emailButton.firstChild);
      if (!contact.whatsapp) emailButton.className = 'btn btn--primary';
    } else {
      emailButton.remove();
    }

    // The small print names the app(s) that will actually open.
    const small = $('#form-small');
    if (small) {
      const app = contact.whatsapp && contact.email ? 'WhatsApp or your email app' : (contact.whatsapp ? 'WhatsApp' : 'your email app');
      small.textContent = 'Nothing is sent from this website: your message opens in ' + app + ', ready for you to check and send.';
    }

    const fields = [nameInput, typeInput, dateInput, messageInput].filter(function (f) { return document.contains(f); });
    const labels = {
      name: 'Your name',
      type: 'What is the project?',
      date: 'Preferred date',
      message: 'Tell me about it'
    };
    let attempted = false;
    let lastVia = '';

    function applyCustomRules() {
      nameInput.setCustomValidity(nameInput.value && !nameInput.value.trim() ? 'Please enter your name.' : '');
      const msg = messageInput.value.trim();
      messageInput.setCustomValidity(messageInput.value && msg.length < 10
        ? 'Please add a little more detail (at least 10 characters).'
        : '');
    }

    function messageFor(input) {
      const v = input.validity;
      if (v.valueMissing) {
        if (input === nameInput) return 'Please enter your name.';
        if (input === typeInput) return 'Please choose what the project is.';
        return 'Please write a short message about your project.';
      }
      if (v.customError) return input.validationMessage;
      if (v.tooShort) return 'Please add a little more detail (at least ' + input.minLength + ' characters).';
      if (v.tooLong) return 'Please shorten this to ' + input.maxLength + ' characters or fewer.';
      if (v.rangeUnderflow) return 'Please choose today or a later date.';
      if (v.badInput) return 'Please enter a complete date, or leave it empty.';
      return input.validationMessage || 'Please check this field.';
    }

    function showFieldState(input) {
      const error = document.getElementById(input.id + '-error');
      const valid = input.checkValidity();
      if (valid) {
        input.removeAttribute('aria-invalid');
        if (error) {
          error.textContent = '';
          error.hidden = true;
        }
      } else {
        input.setAttribute('aria-invalid', 'true');
        if (error) {
          error.textContent = messageFor(input);
          error.hidden = false;
        }
      }
      return valid;
    }

    function validateAll() {
      applyCustomRules();
      const invalid = fields.filter(function (input) { return !showFieldState(input); });
      if (invalid.length) {
        status.className = 'form__status is-error';
        status.textContent = invalid.length === 1
          ? 'Please check one field: ' + labels[invalid[0].name] + '.'
          : 'Please check ' + invalid.length + ' fields: ' + invalid.map(function (f) { return labels[f.name]; }).join(', ') + '.';
        invalid[0].focus();
        return false;
      }
      status.className = 'form__status';
      status.textContent = '';
      return true;
    }

    fields.forEach(function (input) {
      const recheck = function () {
        if (!attempted) return;
        applyCustomRules();
        showFieldState(input);
        if (fields.every(function (f) { return f.validity.valid; })) {
          status.className = 'form__status';
          status.textContent = '';
        }
      };
      input.addEventListener('input', recheck);
      input.addEventListener('change', recheck);
      input.addEventListener('blur', recheck);
    });

    $$('button[name="via"]', form).forEach(function (button) {
      button.addEventListener('click', function () { lastVia = button.value; });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      attempted = true;
      if (!validateAll()) return;

      let via = (event.submitter && event.submitter.value) || lastVia;
      if (via !== 'whatsapp' && via !== 'email') via = contact.whatsapp ? 'whatsapp' : 'email';
      if (via === 'whatsapp' && !contact.whatsapp) via = 'email';
      if (via === 'email' && !contact.email) via = 'whatsapp';

      const data = {
        ownerFirstName: ownerFirstName,
        name: nameInput.value.trim(),
        type: document.contains(typeInput) ? typeInput.value : '',
        date: formatDate(dateInput.value),
        message: messageInput.value.trim()
      };
      const body = buildMessage(data);

      status.className = 'form__status';
      if (via === 'whatsapp') {
        openExternal('https://wa.me/' + contact.whatsapp.digits + '?text=' + encodeURIComponent(body), true);
        status.textContent = 'Opening WhatsApp with your message. If it does not open, message ' + contact.whatsapp.display + ' directly.';
      } else {
        const subject = 'Project enquiry' + (data.type ? ': ' + data.type : '') + ' (' + data.name + ')';
        openExternal('mailto:' + contact.email +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body.replace(/\n/g, '\r\n')), false);
        status.textContent = 'Opening your email app with your message. If nothing happens, write to ' + contact.email + ' directly.';
      }
    });
  }

  /* ---- Footer ---- */

  function renderFooter(site, contact) {
    $('#footer-copy').textContent = '© ' + new Date().getFullYear() + ' ' + site.name;
    const social = $('#footer-social');
    const order = ['instagram', 'youtube', 'whatsapp', 'email'];
    const entries = order
      .map(function (key) { return contact.directory.filter(function (d) { return d.key === key; })[0]; })
      .filter(Boolean);
    if (!entries.length) return;
    append(social, entries.map(function (entry) {
      const attrs = Object.assign({
        href: entry.href,
        'aria-label': entry.label + (entry.external ? ' (opens in a new tab)' : ''),
        title: entry.label
      }, externalAttrs(entry));
      return el('li', null, el('a', attrs, icon(entry.icon)));
    }));
    social.hidden = false;
  }

  /* -------------------------------------------------------------------
     5. Behaviour
     ------------------------------------------------------------------- */

  /* ---- Video player (native <dialog>) ---- */
  let player = null;
  let playerOpener = null;

  function clearPlayer() {
    $$('iframe', $('#player-frame')).forEach(function (frame) { frame.remove(); });
  }

  function setupPlayer() {
    player = $('#player');
    if (!player || typeof player.showModal !== 'function') {
      player = null;
      return;
    }
    $('#player-close').addEventListener('click', function () { player.close(); });
    // A click on the dark backdrop lands on the <dialog> itself.
    player.addEventListener('click', function (event) {
      if (event.target === player) player.close();
    });
    player.addEventListener('close', function () {
      clearPlayer();
      root.classList.remove('is-dialog-open');
      const opener = playerOpener;
      playerOpener = null;
      if (opener && document.contains(opener)) opener.focus();
    });
  }

  function openPlayer(item, opener) {
    const video = item.video;
    if (!player) {
      openExternal(watchUrl(video), true); // Very old browsers: watch on the video site instead.
      return;
    }
    playerOpener = opener || document.activeElement;
    $('#player-title').textContent = item.title;
    clearPlayer();

    const frame = document.createElement('iframe');
    frame.src = embedUrl(video);
    frame.title = item.title + ' (video player)';
    frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    $('#player-frame').appendChild(frame);

    const source = $('#player-source');
    source.href = watchUrl(video);
    source.textContent = '';
    append(source, [
      video.provider === 'youtube' ? 'Watch on YouTube' : 'Watch on Vimeo',
      icon('external'),
      el('span', { class: 'sr-only', text: ' (opens in a new tab)' })
    ]);

    root.classList.add('is-dialog-open');
    if (!player.open) player.showModal();
  }

  /* ---- Mobile menu ---- */
  /* -------------------------------------------------------------------
     Hero title fit. A name should never be broken in the middle of a
     word. On a narrow phone, or while a wide fallback font is showing
     before Oswald has loaded, the longest word can be wider than the
     hero; then the title is scaled down just enough to fit, and scaled
     back up when the fonts arrive or the window grows.
     ------------------------------------------------------------------- */
  function setupHeroFit() {
    const title = $('.hero__title');
    if (!title) return;

    function fit() {
      title.style.fontSize = '';
      const words = title.textContent.split(/\s+/).filter(Boolean);
      const available = title.clientWidth;
      if (!words.length || !available) return;

      const style = getComputedStyle(title);
      const probe = el('span', { 'aria-hidden': 'true' });
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;';
      ['fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'letterSpacing', 'textTransform'].forEach(function (prop) {
        probe.style[prop] = style[prop];
      });
      document.body.appendChild(probe);
      let widest = 0;
      words.forEach(function (word) {
        probe.textContent = word;
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      });
      probe.remove();

      if (widest > available) {
        // Never shrink below 55% of the designed size: past that, an
        // unusually long word is better broken than made unreadable.
        const scale = Math.max(available / widest, 0.55);
        title.style.fontSize = (parseFloat(style.fontSize) * scale * 0.98) + 'px';
      }
    }

    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    let timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(fit, 100);
    });
  }

  function setupMenu() {
    const button = $('#menu-toggle');
    const nav = $('#site-nav');
    const header = $('#site-header');
    if (!button || !nav) return;
    const desktop = window.matchMedia('(min-width: 48em)');

    function setOpen(open, returnFocus) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
      if (!open && returnFocus) button.focus();
    }

    function isOpen() {
      return button.getAttribute('aria-expanded') === 'true';
    }

    button.addEventListener('click', function () { setOpen(!isOpen()); });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) setOpen(false, true);
    });
    document.addEventListener('click', function (event) {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });
    // Keyboard: when focus tabs out of the header, close the panel so the
    // newly focused control is not hidden underneath it. relatedTarget is
    // null when focus goes to the browser's own UI; the menu stays open then.
    header.addEventListener('focusout', function (event) {
      if (isOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    const onChange = function (event) {
      if (event.matches) setOpen(false);
    };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ---- Running timecode and the pause control ---- */
  function readPaused() {
    try {
      return window.localStorage.getItem('dm-motion-paused') === '1';
    } catch (e) {
      return false;
    }
  }

  function savePaused(paused) {
    try {
      window.localStorage.setItem('dm-motion-paused', paused ? '1' : '0');
    } catch (e) {
      /* Storage can be blocked; the toggle still works for this visit. */
    }
  }

  function setupTimecode() {
    const output = $('#timecode');
    const toggle = $('#motion-toggle');
    const label = $('#rec-label');
    const hero = $('#hero');
    if (!output) return;

    const FPS = 25;
    let frameId = 0;
    let lastFrame = -1;
    let heroVisible = true;
    let paused = readPaused();
    // Like a real recorder, the counter only advances while it is running:
    // "elapsed" holds the time of earlier runs, "runStart" the current one.
    let elapsed = 0;
    let runStart = 0;

    function nowMs() {
      return window.performance ? performance.now() : Date.now();
    }

    function tick(now) {
      const frames = Math.floor(((elapsed + (now - runStart)) / 1000) * FPS);
      if (frames !== lastFrame) {
        lastFrame = frames;
        output.textContent = timecode(frames, FPS);
      }
      frameId = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      if (runStart) {
        elapsed += nowMs() - runStart;
        runStart = 0;
      }
    }

    function update() {
      stop();
      root.classList.toggle('is-paused', paused);
      if (toggle) {
        toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      }
      if (label) label.textContent = paused ? 'STBY' : 'REC';
      if (reduceMotion.matches) {
        output.textContent = '00:00:00:00';
        return;
      }
      if (!paused && heroVisible && !document.hidden) {
        runStart = nowMs();
        frameId = window.requestAnimationFrame(tick);
      }
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        paused = !paused;
        savePaused(paused);
        update();
      });
    }
    document.addEventListener('visibilitychange', update);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', update);
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[entries.length - 1].isIntersecting;
        update();
      }).observe(hero);
    }
    update();
  }

  /* ---- Reveal on scroll ---- */
  function setupReveal() {
    const items = $$('[data-reveal]');
    const showAll = function () { items.forEach(function (item) { item.classList.add('is-visible'); }); };
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    items.forEach(function (item) { observer.observe(item); });
    root.classList.add('reveal-ready');
    window.addEventListener('beforeprint', showAll);
  }

  /* ---- Notes for the owner, shown only on their own computer ---- */
  function addPreviewNote(message) {
    const banner = $('#preview-banner');
    if (!banner) return;
    if (!notesList) {
      notesList = el('ul');
      const hide = el('button', { type: 'button', text: 'Hide' });
      hide.addEventListener('click', function () { banner.hidden = true; });
      append(banner, [
        el('p', { class: 'preview-banner__title', text: 'Notes about content.js (only shown on your own computer, never on the live site):' }),
        notesList,
        hide
      ]);
    }
    notesList.appendChild(el('li', { text: message }));
    banner.hidden = false;
  }

  function showPreviewNotes(site) {
    if (!isLocalPreview()) return;
    if (!site.loaded) {
      addPreviewNote('assets/js/content.js could not be read. This usually means a missing comma, quote mark or bracket near the last line you changed. Open the browser console to see the line number.');
    }
    notes.forEach(addPreviewNote);
    notesReady = true;
  }

  /* -------------------------------------------------------------------
     6. Start
     ------------------------------------------------------------------- */

  function safely(name, fn) {
    try {
      fn();
    } catch (error) {
      if (window.console && console.error) console.error('[site] ' + name + ' failed:', error);
    }
  }

  function init() {
    root.classList.remove('no-js');
    root.classList.add('js');

    const site = readSite();
    if (!site.loaded && window.console && console.error) {
      console.error('[site] window.SITE is missing. Check assets/js/content.js for a typing mistake (a missing comma, quote or bracket).');
    }
    let contact = { directory: [] };

    safely('identity', function () { renderIdentity(site); });
    safely('contact details', function () { contact = readContact(site.contact); });
    safely('hero', function () { renderHero(site); });
    safely('hero fit', setupHeroFit);
    safely('work', function () { renderWork(site, contact); });
    safely('services', function () { renderServices(site); });
    safely('process', function () { renderProcess(site); });
    safely('about', function () { renderAbout(site); });
    safely('contact', function () { renderContact(site, contact); });
    safely('footer', function () { renderFooter(site, contact); });
    safely('player', setupPlayer);
    safely('menu', setupMenu);
    safely('timecode', setupTimecode);
    safely('reveal', setupReveal);
    safely('notes', function () { showPreviewNotes(site); });

    // Content above a #link target has just been built, so settle on it again.
    safely('hash', function () {
      if (location.hash.length < 2) return;
      let id = location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch (e) {
        /* A mangled fragment such as "#%" is left as written. */
      }
      const target = document.getElementById(id);
      if (target && !target.hidden) {
        window.requestAnimationFrame(function () { target.scrollIntoView(); });
      }
    });
  }

  init();
})();
