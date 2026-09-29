# Third-party code in this folder

These files are copied here unchanged so the site never loads anything from
another server (the page's Content-Security-Policy only allows its own scripts).
Only the files the site actually uses are included.

## GSAP 3.15.0 (`gsap.min.js`, `ScrollTrigger.min.js`)

- Website: https://gsap.com
- Copyright 2026, GreenSock. All rights reserved.
- Licence: GSAP "Standard" licence (no charge, free for commercial use),
  https://gsap.com/standard-license
- Used for: the timed animations (countdown, hero, reveals, shutter, card
  and section set pieces) and the scroll-linked effects (timeline bar,
  reveals, the pinned film strip, the export bar, the about parallax).

## Lenis 1.3.26 (`lenis.min.js`)

- Website: https://lenis.darkroom.engineering
- Copyright (c) 2024 darkroom.engineering
- Licence: MIT (full text below)
- Used for: smooth wheel scrolling on desktop only (anchor links, the
  timeline bar and dragging the film strip scroll through it). The few CSS
  rules Lenis needs are inlined in `assets/css/motion.css` (marked "Lenis").

### MIT License (Lenis)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
