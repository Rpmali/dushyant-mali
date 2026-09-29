# Dushyant Mali: portfolio website

This is the personal website of Dushyant Mali, freelance videographer, video editor and social
media marketer. It shows your videos, the services you offer, how you work, a short About section
and a contact form that opens WhatsApp or email with the visitor's message already written. It is a plain website (HTML,
CSS and a little JavaScript): no installation, no build step, no monthly cost. GitHub Pages hosts
it for free.

Live address, once GitHub Pages is switched on: **https://rpmali.github.io/dushyant-mali/**

---

## Edit your details

Everything you normally change lives in **one file: `assets/js/content.js`**. You never need to
touch the other files to update your text, videos or contact details.

1. Open the repository on GitHub and click `assets`, then `js`, then `content.js`.
2. Click the **pencil icon** (Edit this file) at the top right of the file.
3. Change the text **between the quote marks**. Keep the quote marks and the comma at the end of
   each line. Lines starting with `//` are notes for you; the website ignores them.
4. Click **Commit changes...**, write a short note such as "Add wedding film", and click
   **Commit changes** again.
5. Wait a minute or two and refresh the website.

Any field left as `""` (empty) is simply hidden, so the page never shows an empty box.

### Every field

| Field | What it does | Example |
|---|---|---|
| `siteUrl` | The public address of the site, written down for reference. The page itself does not read this line; with a custom domain, the lines that matter are listed under "Custom domain" below. | `"https://rpmali.github.io/dushyant-mali/"` |
| `name` | Your name, shown in the header, the big title, the footer and the browser tab. | `"Dushyant Mali"` |
| `role` | What you do, shown above your name. | `"Videographer, Video Editor & Social Media Marketer"` |
| `tagline` | One short line under your name. Rewrite it in your own words. | `"Video shooting, editing and social media marketing, from the first frame to the final post."` |
| `location` | Your city or area, shown as a small tag under the tagline. | `"Your City, State"` |
| `availability` | Optional note shown as a second tag. | `"Taking bookings for weddings and brand shoots"` |
| `about` | Paragraphs for the About section, each in its own quotes, separated by commas. While empty, one plain line built from your name and role is shown. | `["First paragraph.", "Second paragraph."]` |
| `photo` | A photo of you (upload it first, see below). While empty, a "DM" monogram is shown. | `"assets/img/profile.jpg"` |
| `contact.email` | Your email. Turns on the "Send by email" button and an email link. | `"name@example.com"` |
| `contact.whatsapp` | Your WhatsApp number **with country code**. Spaces and dashes are fine. Turns on the "Send on WhatsApp" button. | `"+91 98765 43210"` |
| `contact.phone` | A number for calls, shown as written, tappable on phones. | `"+91 98765 43210"` |
| `contact.instagram` | Your Instagram username (with or without `@`) or profile link. | `"@yourname"` |
| `contact.youtube` | The full link to your YouTube channel. | `"https://www.youtube.com/@yourchannel"` |
| `showreel.video` | A YouTube or Vimeo link. Adds a "Play showreel" button at the top of the page. | `"https://youtu.be/VIDEO_ID_HERE"` |
| `showreel.poster` | Optional wide picture used as the background at the top of the page. | `"assets/img/poster.jpg"` |
| `services` | Your services. Each has a `title`, a `description` and a list of `points`. They are also the choices in the contact form. Delete any you do not offer. | see `content.js` |
| `process` | The steps of working with you. Each has a `title` and a `text`. | see `content.js` |
| `projects` | Your videos (see the next section). While empty, the Work section says new work is being added. | see below |

If you fill in **neither** email nor WhatsApp, the contact form is hidden (it would have nowhere
to send to) and only your other contact links are shown.

The phone and WhatsApp numbers above are examples only; use your own.

Changing `name` or `role` updates the page itself, but the title, description and picture shown
when the link is shared on WhatsApp come from `index.html` (see "For whoever helps maintain this"
below).

---

## Add a video

1. Upload the video to **YouTube** (choosing "Unlisted" is fine: it plays on your site but does
   not appear in YouTube search) or to **Vimeo**.
2. Under the video, click **Share** and **Copy** the link.
3. In `content.js`, find the line `projects: [],` near the bottom and **replace that whole line**
   with one of the blocks below.

For one video the block looks like this (copy it exactly, then change the words and paste your
link in place of `PASTE_YOUR_LINK_HERE`):

```js
  projects: [
    {
      title: "Name of the film",
      category: "Wedding",
      video: "PASTE_YOUR_LINK_HERE",
      year: 2025,
      role: "Shot & edited",
      description: "One or two sentences about the film.",
    },
  ],
```

For more videos, use this shape instead: one `{ ... },` block per video, all inside the same
`projects: [` and `],`:

```js
  projects: [
    {
      title: "First film",
      category: "Wedding",
      video: "PASTE_LINK_1_HERE",
      featured: true,
    },
    {
      title: "Second film",
      category: "Music Video",
      video: "PASTE_LINK_2_HERE",
    },
    {
      title: "A reel on Instagram",
      category: "Reel",
      link: "PASTE_INSTAGRAM_LINK_HERE",
      thumbnail: "assets/img/reel-cover.jpg",
    },
  ],
```

**What each project field means**

| Field | Needed? | What it does |
|---|---|---|
| `title` | yes | Name shown on the card and above the player. |
| `video` | this **or** `link` | A YouTube or Vimeo link. The video plays in a window on your site. |
| `link` | this **or** `video` | Any other web address (for example an Instagram reel). The card opens it in a new tab. |
| `category` | optional | Any word, e.g. `"Wedding"`, `"Music Video"`, `"Brand Film"`, `"Event"`, `"Reel"`. When you use two or more different categories, filter buttons appear above the videos automatically. |
| `thumbnail` | optional | A picture for the card, e.g. `"assets/img/wedding.jpg"`. YouTube pictures are added automatically. Vimeo videos and `link` cards show a neat title card if you give none. |
| `year` | optional | e.g. `2025` |
| `client` | optional | The client's name. Only add it if the client is happy to be named. |
| `role` | optional | What you did, e.g. `"Shot & edited"`. |
| `description` | optional | One or two sentences. |
| `featured` | optional | Write `featured: true,` to show this video first. |

**Links that work for `video`**

- YouTube: `https://youtu.be/...`, `https://www.youtube.com/watch?v=...`, `https://youtube.com/shorts/...`,
  `https://www.youtube.com/live/...`, `https://www.youtube.com/embed/...`, `m.youtube.com` and
  `music.youtube.com` links, or just the 11-character video ID.
- Vimeo: `https://vimeo.com/123456789`, `https://vimeo.com/channels/name/123456789`,
  `https://player.vimeo.com/video/123456789`, or just the number. Private-link Vimeo videos
  (`https://vimeo.com/123456789/abcdef1234`) keep their private code.

If a link cannot be read, that card is left out (or, if it also has a `link`, the card opens that
link instead) and a note is written to the browser console. When you preview on your own
computer (see below), the same notes also appear in a small box at the bottom of the page.

If a YouTube video shows an error inside your site, open it in YouTube Studio and check that
**Allow embedding** is switched on. The player window always has a "Watch on YouTube" (or Vimeo)
link as a fallback.

---

## Add your photo

1. On GitHub, open the `assets` folder, then `img`.
2. Click **Add file** > **Upload files**, drag your photo in, and click **Commit changes**.
3. In `content.js`, set `photo` to the path, for example `photo: "assets/img/profile.jpg",`

Tips:

- Use simple lowercase file names without spaces, e.g. `profile.jpg`. GitHub Pages treats
  `Profile.JPG` and `profile.jpg` as different files.
- A portrait (taller than wide) photo about 1000 to 1500 pixels tall, under 500 KB, loads fast
  and looks sharp.
- Card thumbnails (`thumbnail`) and the showreel `poster` are uploaded the same way. Wide
  (16:9) pictures suit them best.

---

## Preview on your computer

**Quick look:** download the repository (on GitHub: **Code** > **Download ZIP**), unzip it and
double-click `index.html`. Everything is shown, but videos may refuse to play when the page is
opened as a file, because YouTube and Vimeo expect a real web address.

**Full preview (videos and the 404 page too):** open a terminal in the folder that **contains**
the `dushyant-mali` folder and run:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000/dushyant-mali/** in your browser. (The `/dushyant-mali/` part
matters: it copies how GitHub Pages serves the site.) To see the "page not found" page, open
http://localhost:8000/dushyant-mali/404.html . Press `Ctrl + C` in the terminal to stop.

While previewing on your own computer, if something in `content.js` cannot be used (a mistyped
video link, an email without `@`, a missing comma), a small **notes box** appears at the bottom
of the page explaining what to fix. It is never shown on the live site.

---

## Publish with GitHub Pages

1. On GitHub, open the repository and click **Settings**.
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to **main** and the folder to **/ (root)**, then click **Save**.
5. Wait a minute or two and refresh the page. The address appears at the top:
   **https://rpmali.github.io/dushyant-mali/**

After that, every change you commit is published automatically within a minute or two.

To get the site into Google, add it to **Google Search Console** (https://search.google.com/search-console):
choose the **URL prefix** option, enter `https://rpmali.github.io/dushyant-mali/`, and verify with the
**HTML tag** method by pasting the `<meta name="google-site-verification" ...>` line it gives you
into the `<head>` of `index.html` (just below the `<meta name="author" ...>` line). Then, under
**Sitemaps**, submit `https://rpmali.github.io/dushyant-mali/sitemap.xml`. This step is needed
because on a `github.io` address the `robots.txt` in this folder is never read by search engines
(they only look at the top of `rpmali.github.io`).

Notes:

- On a free GitHub account, the repository must be **public** for GitHub Pages to work.
- The address above assumes the GitHub account is `rpmali` and the repository is named
  `dushyant-mali`. If either changes, update the address in the places listed under
  "Custom domain" below, and the `<base href="/dushyant-mali/">` line in `404.html`.

---

## Custom domain (optional)

If you buy your own domain (for example `www.yourname.com`):

1. On GitHub: **Settings** > **Pages** > **Custom domain**, type the domain and click **Save**.
   GitHub adds a file called `CNAME` to the repository for you. Do not delete it.
2. At the company where you bought the domain, add the DNS records GitHub asks for. For a
   `www` address this is a `CNAME` record pointing to `rpmali.github.io`. GitHub's guide covers
   every case: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
3. When GitHub shows it is ready, tick **Enforce HTTPS**.
4. Change `https://rpmali.github.io/dushyant-mali/` to your new address (for example
   `https://www.yourname.com/`) in:
   - `assets/js/content.js`: `siteUrl` (for reference only; the page does not read it)
   - `index.html`: the `canonical`, `og:url`, `og:image` and `twitter:image` lines, and the
     `"url"` in the Person block near the top (the image lines keep `assets/img/og-image.png`
     at the end)
   - `robots.txt`: the `Sitemap:` line (keep `sitemap.xml` at the end)
   - `sitemap.xml`: the `<loc>` line
5. In `404.html`, change `<base href="/dushyant-mali/">` to `<base href="/">`, because the site
   now lives at the root of the domain.

---

## Before you share the link

- [ ] Email and/or WhatsApp filled in under `contact`
- [ ] At least 3 videos added to `projects`
- [ ] `about` written in your own words (and the `tagline` too)
- [ ] `location` added, if you want clients to know where you are based
- [ ] Site opened on a phone: menu, videos and contact form all work
- [ ] "Send on WhatsApp" and "Send by email" tested: each opens with the message filled in
- [ ] Link sent to yourself on WhatsApp to check the preview picture and title

---

## For whoever helps maintain this

- **No build, no dependencies.** `index.html` loads `assets/js/content.js` (which sets
  `window.SITE`) and then `assets/js/main.js`, which builds every section from it. Content is a
  plain script rather than JSON so the site also works when opened as a file.
- **Safe rendering.** All content is inserted with `textContent`/`createElement`; links from
  `content.js` are limited to `http(s)`, `mailto:` and `tel:`. A Content-Security-Policy meta tag
  allows only the site's own scripts and styles, Google Fonts, images, and player frames from
  `www.youtube-nocookie.com` and `player.vimeo.com`.
- **Videos load on demand.** Nothing is requested from YouTube or Vimeo until a card is clicked
  (apart from YouTube thumbnail images on `i.ytimg.com`). The player is a native `<dialog>`; its
  iframe is removed on close so playback stops.
- **Contact form without a server.** It validates in the browser, then opens
  `https://wa.me/<number>?text=...` or `mailto:...` with the message filled in. Nothing is stored.
- **Link previews and search engines** read the static tags in `index.html`, not `content.js`,
  because preview bots do not run JavaScript. If the name or role changes, update the `<title>`,
  the description, the `og:`/`twitter:` tags and the Person block in `index.html`, the title and
  the wordmark text in the header of `404.html` (which has no JavaScript), and make a new
  `og-image.png` (it shows the name and role).
- **Images.** `assets/img/og-image.png` (1200 x 630) and `assets/img/apple-touch-icon.png`
  (180 x 180) are plain images; replace them with files of the same size and name if the design
  changes. `favicon.svg` is the "DM" logo with the red recording dot.
- **Accessibility and motion.** Skip link, keyboard-friendly menu and player, labelled form fields
  with spoken error messages, and WCAG AA colour contrast. The hero's blinking REC dot and running
  timecode can be paused with the button in its top-right corner, and all animation is switched
  off for visitors whose device asks for reduced motion.

### File map

```
dushyant-mali/
├── index.html              the page (structure and link-preview tags)
├── 404.html                "page not found", shown by GitHub Pages
├── assets/
│   ├── css/styles.css      all styling; colours and sizes are variables at the top
│   ├── js/content.js       YOUR CONTENT: the only file to edit day to day
│   ├── js/main.js          builds the page from content.js
│   └── img/
│       ├── favicon.svg          browser tab icon
│       ├── apple-touch-icon.png home-screen icon (iPhone and iPad)
│       └── og-image.png         picture shown when the link is shared
├── robots.txt              only read by search engines once the site is on its own domain
├── sitemap.xml             the site's address for search engines (submit it in Search Console)
├── .nojekyll               tells GitHub Pages to serve the files as they are
├── .gitignore              keeps system and editor clutter out of the repository
└── README.md               this guide
```

---

## Rights

The code in this repository (HTML, CSS and JavaScript) may be reused and adapted. The name
Dushyant Mali, the DM logo, and all videos, photos and written content belong to Dushyant Mali
and may not be reused without permission.
