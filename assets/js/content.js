/* =====================================================================
   YOUR WEBSITE CONTENT
   =====================================================================

   This is the only file you need to edit to change what your website
   says. Everything on the page (your name, videos, services, contact
   buttons) is built from the details below.

   HOW TO EDIT SAFELY
   ------------------
   1. Only change the text BETWEEN the quote marks "like this".
   2. Keep the quote marks, and keep the comma at the end of each line.
   3. A line that starts with // is a note for you. The website ignores
      it, so you can read it, change it or delete it freely.
   4. If you need a quote mark inside your text, use a curly one (’ or “)
      or type \" instead of ".
   5. Leave a field as "" (two quote marks, nothing inside) if you do not
      want it on the site yet. Empty fields are simply hidden, so the
      page never shows a blank box.

   After saving, open the website and check it. If the page looks empty
   or a section is missing, the most common cause is a missing comma or
   quote mark near the line you changed.
   ===================================================================== */

window.SITE = {

  // ---------------------------------------------------------------
  // WEBSITE ADDRESS
  // ---------------------------------------------------------------
  // The public address of this website (it is hosted on Vercel), written
  // down here for reference. The page itself does NOT read this line, so
  // changing it alone changes nothing. If you buy your own domain (for
  // example "https://www.yourname.com/"), update it here AND in the places
  // that actually matter:
  //   - index.html (the lines with "canonical", "og:url", "og:image",
  //     "twitter:image" and the "url" inside the Person block)
  //   - robots.txt
  //   - sitemap.xml
  //   - 404.html (the <base href> line stays "/" while the site is served
  //     from the root of a domain, as on Vercel)
  siteUrl: "https://dushyant-mali.vercel.app/",

  // ---------------------------------------------------------------
  // ABOUT YOU
  // ---------------------------------------------------------------

  // Your name, exactly as you want it shown.
  name: "Dushyant Mali",

  // What you do. Shown above your name and in the browser tab.
  role: "Videographer, Video Editor & Social Media Marketer",

  // One short line under your name. This is only a starting point:
  // rewrite it in your own words.
  tagline: "Video shooting, editing and social media marketing, from the first frame to the final post.",

  // Your city or area, e.g. "Your City, State". Leave "" to hide.
  location: "Surat, Gujarat",

  // Optional short note about your availability, e.g.
  // "Taking bookings for weddings and brand shoots". Leave "" to hide.
  availability: "",

  // A few short paragraphs about you, each one inside its own quote
  // marks, separated by commas. Rewrite these in your own words, or add
  // more. If you empty the list (about: []), the About section shows one
  // plain line built from your name and role, never made-up details.
  about: [
    "I’m Dushyant Mali, a freelance videographer and video editor with 5+ years of experience in video shooting and editing.",
    "Alongside the camera work, I have 3+ years of experience in social media marketing: planning and running ad campaigns and managing brands’ social media accounts.",
    "That mix means a video does not stop at the final cut. I can shoot it, edit it for the platform it is going to, and run the account or campaign it is posted on.",
  ],

  // Optional photo of you. Upload the picture into the assets/img
  // folder first, then write its path here, e.g. "assets/img/profile.jpg".
  // A portrait (taller than wide) photo looks best.
  // While this is empty, a neat "DM" monogram is shown instead.
  photo: "",

  // ---------------------------------------------------------------
  // CONTACT DETAILS
  // ---------------------------------------------------------------
  // Fill in what you want shown. Anything left as "" is not shown anywhere.
  // The contact form shows a "Send on WhatsApp" button only when
  // whatsapp is filled in, and a "Send by email" button only when
  // email is filled in. If both are empty, the form is hidden.
  contact: {
    // Your email address, e.g. "name@example.com"
    email: "dushyantmali7046@gmail.com",

    // Your WhatsApp number WITH the country code, e.g. "+91 98765 43210".
    // Spaces, dashes and brackets are fine; the website cleans them up.
    // Write the number only: no words, hours or extension after it.
    // (A 10-digit number without a country code is treated as Indian, +91.)
    whatsapp: "+91 70460 12795",

    // A phone number for calls, e.g. "+91 98765 43210". Shown as written.
    phone: "",

    // Your Instagram username, e.g. "yourname" or "@yourname",
    // or the full link "https://www.instagram.com/yourname/".
    instagram: "",

    // The full link to your YouTube channel,
    // e.g. "https://www.youtube.com/@yourchannel".
    youtube: "",
  },

  // ---------------------------------------------------------------
  // SHOWREEL (optional)
  // ---------------------------------------------------------------
  // A short video of your best shots. When "video" is filled in, a
  // "Play showreel" button appears at the top of the page.
  //   video:  a YouTube or Vimeo link, e.g. "https://youtu.be/VIDEO_ID_HERE"
  //   poster: optional background picture for the top of the page, e.g.
  //           "assets/img/poster.jpg" (upload it to assets/img first).
  //           A wide (landscape) picture works best.
  //   clips:  optional short clips that play silently behind the top of
  //           the page, in place of the animated light-leak background.
  //           Upload them to assets/video first, then list their paths:
  //             clips: ["assets/video/clip-1.mp4", "assets/video/clip-2.mp4"],
  //           They play one after another and repeat, muted, only while
  //           that part of the page is on screen. To offer a smaller .webm
  //           copy of a clip, list it right before the .mp4 with the same
  //           name (the browser plays the first one it can):
  //             clips: ["assets/video/clip-1.webm", "assets/video/clip-1.mp4"],
  //           Recommended: 6 to 10 seconds, 720p, H.264 .mp4 under 2 MB
  //           each. The poster above is shown before the clip starts.
  //           A clip that cannot be found is skipped and the others play.
  //           Clips only play in the animated version of the page (the
  //           button at the top right turns it off and on) and never for
  //           visitors whose device asks for less motion.
  showreel: {
    video: "",
    poster: "",
    clips: [],
  },

  // ---------------------------------------------------------------
  // MOTION (optional)
  // ---------------------------------------------------------------
  // The page has an animated version (letterbox, timeline bar, smooth
  // scrolling and so on). Visitors can turn it off with the button at
  // the top right; it also stays off for anyone whose device asks for
  // less motion. This setting only controls the intro, the short scene
  // shown once per visit when the page opens (a click, a tap or any key
  // skips it):
  //   intro: "camera"     a camera slides in, focuses on the visitor,
  //                       fires one flash, and the photo it takes becomes
  //                       the top of the page (about 4 seconds, shorter
  //                       on phones). This is the default.
  //   intro: "countdown"  the older 3-2-1 film-leader countdown instead.
  //   intro: false        no intro at all: the page simply appears.
  // Anything else is treated as "camera".
  motion: {
    intro: "camera",
  },

  // ---------------------------------------------------------------
  // BEFORE / AFTER (optional)
  // ---------------------------------------------------------------
  // Show your colour grading: a slider above the services that compares
  // the raw frame (before) with your graded version (after). Upload two
  // pictures of the SAME width and height (e.g. both 1600 x 900) to the
  // assets/img folder, then write their paths here. Leave both "" to
  // hide the slider. Visitors drag the line or use the arrow keys.
  grade: {
    before: "",
    after: "",
  },

  // ---------------------------------------------------------------
  // SERVICES
  // ---------------------------------------------------------------
  // What you offer. Edit the words, and delete any you do not offer
  // (delete everything from its { to its matching }, plus the comma).
  // Each service has:
  //   title:       the name of the service
  //   description: one or two sentences
  //   points:      a short list of bullet points (can be empty: [])
  // These are also the choices in the contact form's
  // "What is the project?" list.
  services: [
    {
      title: "Video Shooting",
      description: "On-location filming for events, brands and personal projects, planned around the story you want to tell.",
      points: [
        "Shot planning before the day",
        "Filming on location",
        "Interviews and supporting footage",
      ],
    },
    {
      title: "Video Editing",
      description: "Turning raw footage into a clear, well-paced film, with the story, music, titles and sound brought together in one cut.",
      points: [
        "Story and pacing",
        "Music, titles and captions",
        "Sound clean-up and mix",
      ],
    },
    {
      title: "Colour Grading",
      description: "Correcting and grading footage so every shot matches and the whole film carries one consistent look.",
      points: [
        "Colour correction and shot matching",
        "A consistent look across the film",
        "Natural-looking skin tones",
      ],
    },
    {
      title: "Reels & Short-form",
      description: "Vertical edits for social media, cut to hold attention from the very first second.",
      points: [
        "Vertical 9:16 format",
        "Captions and on-screen text",
        "Short cut-downs from longer films",
      ],
    },
    {
      title: "Social Media Management",
      description: "Running brand social media accounts day to day: planning the content, posting it and keeping the feed consistent.",
      points: [
        "Content planning and posting",
        "Managing brand accounts",
        "Video made for the feed",
      ],
    },
    {
      title: "Ad Campaigns",
      description: "Planning and running paid social media campaigns for brands, with the video and creatives made to match.",
      points: [
        "Campaign planning and setup",
        "Ad videos and creatives",
        "Running and adjusting live campaigns",
      ],
    },
  ],

  // ---------------------------------------------------------------
  // HOW YOU WORK
  // ---------------------------------------------------------------
  // The steps a client goes through with you. Edit the words freely.
  process: [
    {
      title: "Brief",
      text: "You tell me what you need: the occasion or idea, where and when, and where the video will be shown.",
    },
    {
      title: "Plan & Shoot",
      text: "We agree on a plan and a shot list, then I film on the day with the story in mind.",
    },
    {
      title: "Edit & Grade",
      text: "I cut the footage, add music and sound, grade the colour and share a draft for your feedback.",
    },
    {
      title: "Deliver",
      text: "You receive the final video in the formats you need, ready to post, screen or share.",
    },
  ],

  // ---------------------------------------------------------------
  // YOUR WORK (VIDEOS)
  // ---------------------------------------------------------------
  // Each project is one video card on the page. Until you add some,
  // the Work section shows a "new work is being added" message.
  //
  // HOW TO ADD A VIDEO
  // 1. Upload it to YouTube ("Unlisted" is fine) or Vimeo.
  // 2. Click "Share" under the video and copy the link.
  // 3. Delete the line  projects: [],  at the very bottom of this file
  //    and put the example block below in its place: remove the // at
  //    the start of each of its lines (from "projects: [" down to "],")
  //    and replace the example text with yours.
  //
  // FIELDS (only title and video, or title and link, are needed):
  //   title:       name of the project
  //   category:    any word you like, e.g. "Wedding", "Music Video",
  //                "Brand Film", "Event", "Reel". Filter buttons are
  //                made from these automatically.
  //   video:       a YouTube or Vimeo link (or just its ID). The video
  //                opens and plays on your site.
  //   link:        use INSTEAD of video for anything else, e.g. an
  //                Instagram reel. It opens in a new tab.
  //   thumbnail:   optional picture for the card, e.g.
  //                "assets/img/wedding.jpg". YouTube pictures are
  //                added automatically; Vimeo and link cards need one,
  //                otherwise a neat title card is shown.
  //   year:        optional, e.g. 2025
  //   client:      optional, only with the client's permission
  //   role:        optional, what you did, e.g. "Shot & edited"
  //   description: optional, one or two sentences
  //   featured:    optional, write true to show this project first
  //   preview:     optional short silent clip that plays on the card
  //                while a visitor's mouse is over it (never on phones),
  //                e.g. "assets/video/wedding-preview.mp4". Upload it to
  //                the assets/video folder first: 6 to 10 seconds, 720p,
  //                .mp4 (or .webm) under 2 MB. Only in the animated
  //                version of the page.
  //
  // EXAMPLE (the links are placeholders and will not work). When you
  // are ready, it should look like this, with your own details:
  //
  //  projects: [
  //    {
  //      title: "Name of the wedding film",
  //      category: "Wedding",
  //      video: "https://youtu.be/VIDEO_ID_HERE",
  //      year: 2025,
  //      role: "Shot & edited",
  //      description: "A short film of the wedding day.",
  //      featured: true,
  //    },
  //    {
  //      title: "Name of the event film",
  //      category: "Event",
  //      video: "https://vimeo.com/VIDEO_NUMBER_HERE",
  //      thumbnail: "assets/img/event-film.jpg",
  //      year: 2025,
  //    },
  //    {
  //      title: "Name of the reel",
  //      category: "Reel",
  //      link: "https://www.instagram.com/reel/REEL_ID_HERE/",
  //    },
  //  ],
  //
  // Each project sits between { and }, followed by a comma. To add more,
  // copy one of those { ... }, blocks and paste it before the closing ].
  // Videos that cannot be read (for example a mistyped link) are left
  // out of the page instead of showing a broken card.
  projects: [],

};
