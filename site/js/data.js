/* Content for the interactive parts of the page.
   Media paths follow the Google Cloud Storage layout; switch mediaBase to the bucket/CDN URL when uploaded. */
window.BDC = {
  config: {
    whatsapp: "919912251142",
    site: "boscodancecompany.com",
    mediaBase: "media/", // later: "https://media.boscodancecompany.com/"
    slideMs: 6000
  },

  brand: {
    watermark: "brand/company/logo-mark-sm.webp" // BDC mark shown on every video
  },

  /* Bosco David at rehearsals: the video card on his portrait */
  bosco: {
    slug: "bosco-at-work", title: "Bosco at work", eyebrow: "Bosco David at rehearsals",
    poster: "brand/founder/bosco-at-work.jpg",
    film: { type: "mp4", src: "brand/founder/bosco-at-work-film.mp4", ar: 0.762 },
    book: null, bookLabel: "Plan with Bosco"
  },

  /* "Bosco's vision": the Shiva-themed couple entry (built by tools/build_media.py --only vision) */
  vision: {
    slug: "bosco-vision", title: "A wedding entry by Bosco", eyebrow: "Bosco’s vision",
    src: "weddings/bridal-entries/bosco-vision/vision.mp4",
    av1: "weddings/bridal-entries/bosco-vision/vision-av1.mp4",
    poster: "weddings/bridal-entries/bosco-vision/poster.jpg",
    book: "Couple / Varmala entry", bookLabel: "Plan an entry like this"
  },

  /* "Some of our best work" coverflow (videos by Social Lens). Files: raw/showcase/, built by
     tools/build_media.py --only showcase into site/js/media.js. A slide only shows once its video is built. */
  showcase: [
    { slug: "og-grand-sangeet", title: "OG grand sangeet", place: "Novotel, Hyderabad",
      credits: "Decor: Pink Pagdi · Lights: Bablu · Video: Social Lens", book: "Sangeet performance" },
    { slug: "royal-performance", title: "Royal performance", place: "Novotel GMR, Hyderabad",
      credits: "Decor: Ishte Events · Planner: Swastik Events · Video: Social Lens", book: "Sangeet performance" },
    { slug: "royal-couple-entry", title: "Royal bride & groom entry", place: "K Convention, Hyderabad",
      credits: "Decor & planning: SKG Events · Video: Social Lens", book: "Couple / Varmala entry" }
  ],

  /* "The event teams we work with" */
  partners: [
    { slug: "ramoji-film-city", name: "Ramoji Film City", role: "Venue" },
    { slug: "ishte-events", name: "Ishte Events", role: "Decor & events" },
    { slug: "pink-pagdi", name: "Pink Pagdi", role: "Decor" },
    { slug: "the-show", name: "The Show", role: "Events" },
    { slug: "skg-events", name: "SKG Events", role: "Decor & planning" },
    { slug: "swastik-events", name: "Swastik Events", role: "Event planning" },
    { slug: "swastik-decor", name: "Swastik Decor", role: "Decor" },
    { slug: "varshini-creations", name: "Varshini Creations", role: "Events" }
  ],

  /* Picking a filter in "Our work" pre-selects these in the enquiry form */
  intents: [
    { id: "entries", looking: ["Bridal entry", "Groom entry"] },
    { id: "sangeet", looking: ["Sangeet performance"] },
    { id: "spectacle", looking: ["Theme act / Special entry"] },
    { id: "corporate", looking: ["Corporate show"] }
  ],

  /* film.type: "mp4" (self-hosted) | "drive" (Google Drive preview player)
     ar = film aspect ratio (w/h) so the player frames it correctly */
  works: [
    { slug: "peacock-frame-entry", title: "Peacock frame entry", eyebrow: "Bridal entry", cats: ["entries", "spectacle"],
      poster: "weddings/bridal-entries/peacock-frame-entry/poster.jpg",
      film: { type: "drive", id: "1L3dfi7sEHTgNOokJQDwOhw42xpTrThJV", ar: 0.5625 }, book: "Bridal entry", bookLabel: "Book this entry" },
    { slug: "siwpc-bollywood-spectacle", title: "Bollywood act", eyebrow: "SIWPC Global 2024", cats: ["corporate", "spectacle"],
      poster: "corporate/stage-events/siwpc-bollywood-spectacle/poster.jpg", loop: "corporate/stage-events/siwpc-bollywood-spectacle/loop.mp4",
      film: { type: "mp4", src: "corporate/stage-events/siwpc-bollywood-spectacle/film.mp4", ar: 0.5625 }, credit: "Filmed by Snappers", book: "Corporate show", bookLabel: "Book this act" },
    { slug: "modern-classical-varmala", title: "Classical varmala", eyebrow: "Varmala entry", cats: ["entries"],
      poster: "weddings/bridal-entries/modern-classical-varmala/poster.jpg",
      film: { type: "drive", id: "1ChNh6jUqcwBRO-hx5R45x6kq2bzPCxBi", ar: 1.772 }, book: "Couple / Varmala entry", bookLabel: "Book this entry" },
    { slug: "siwpc-devotional-spectacle", title: "Devotional act", eyebrow: "SIWPC Global 2024", cats: ["corporate", "spectacle"],
      poster: "corporate/stage-events/siwpc-devotional-spectacle/poster.jpg", loop: "corporate/stage-events/siwpc-devotional-spectacle/loop.mp4",
      film: { type: "mp4", src: "corporate/stage-events/siwpc-devotional-spectacle/film.mp4", ar: 0.5625 }, credit: "Filmed by Snappers", book: "Theme act / Special entry", bookLabel: "Book this act" },
    { slug: "indian-contemporary-entry", title: "Contemporary couple entry", eyebrow: "Couple entry", cats: ["entries"],
      poster: "weddings/bridal-entries/indian-contemporary-entry/poster.jpg",
      film: { type: "drive", id: "1okL328EYnUtpfi1jZIxfYdzx0GYTmUQw", ar: 0.697 }, book: "Couple / Varmala entry", bookLabel: "Book this entry" },
    { slug: "siwpc-classical-opening-act", title: "Classical opening act", eyebrow: "SIWPC Global 2024", cats: ["corporate", "spectacle"],
      poster: "corporate/stage-events/siwpc-classical-opening-act/poster.jpg",
      film: { type: "drive", id: "1w5jZlRCODUGT_g8wRJwxWOrPadqX3v-1", ar: 1.778 }, credit: "Filmed by Snappers", book: "Corporate show", bookLabel: "Book this act" },
    { slug: "modern-varmala-jaipur", title: "Varmala in Jaipur", eyebrow: "Varmala entry", cats: ["entries"],
      poster: "weddings/bridal-entries/modern-varmala-jaipur/poster.jpg",
      film: { type: "drive", id: "1iBLXkB_ZciPYcWlSL8MOtsB0Hix49D9p", ar: 0.706 }, book: "Couple / Varmala entry", bookLabel: "Book this entry" },
    { slug: "siwpc-hyderabad-tribute", title: "Hyderabad song", eyebrow: "SIWPC Global 2024", cats: ["corporate", "spectacle"],
      poster: "corporate/stage-events/siwpc-hyderabad-tribute/poster.jpg",
      film: { type: "drive", id: "1PAYgaQHzykImTIa2pw0It-3kZ8_hAfO9", ar: 1.778 }, credit: "Filmed by Snappers", book: "Corporate show", bookLabel: "Book this act" },
    { slug: "reception-entry", title: "Reception entry", eyebrow: "Reception", cats: ["entries"],
      poster: "weddings/reception/reception-entry/poster.jpg",
      film: { type: "drive", id: "17tt77VtBRobbq8wlPyD_z9uJL8Le1E66", ar: 1.778 }, book: "Reception act", bookLabel: "Book this entry" },
    { slug: "varmala-hdf", title: "Varmala entry", eyebrow: "Varmala entry", cats: ["entries"],
      poster: "weddings/bridal-entries/varmala-hdf/poster.jpg",
      film: { type: "drive", id: "1314x39zeFw3jvadQAdEZRvDVBbpzkZRY", ar: 0.5625 }, book: "Couple / Varmala entry", bookLabel: "Book this entry" }
  ],

  emptyStates: {
    sangeet: { title: "Sangeet videos coming soon.", line: "Message us and we’ll send you our sangeet videos on WhatsApp.", looking: "Sangeet performance", cta: "Ask for videos" }
  },

  services: [
    { id: "weddings", label: "Weddings", image: "brand/services/weddings.jpg", items: [
      { icon: "crown", title: "Bride & groom entries", line: "Entries for the bride, the groom or both, including varmala and reception entries.", look: "Bridal entry" },
      { icon: "music", title: "Sangeet & mehendi", line: "We teach the couple and family, and bring our own dancers too.", look: "Sangeet performance" },
      { icon: "star", title: "Reception performances", line: "Short acts and entries for the reception.", look: "Reception act" },
      { icon: "users", title: "Dancers for your event", line: "Professional dancers to perform with your family or on their own.", look: "Background dancers" }
    ] },
    { id: "production", label: "Production", image: "brand/services/production.jpg", items: [
      { icon: "box", title: "Props & stage setup", line: "Props and stage pieces made for your performance.", look: "Props & special effects" },
      { icon: "light", title: "Lighting & VJ", line: "Stage lighting and screen visuals that match the act.", look: "Lighting & VJ" },
      { icon: "wave", title: "Music editing", line: "We edit and mix the tracks for every performance.", look: "Music editing" },
      { icon: "clipboard", title: "Show coordination", line: "We plan the running order with your planner, DJ and decor team.", look: "Something else" }
    ] },
    { id: "corporate", label: "Corporate", image: "brand/services/corporate.jpg", items: [
      { icon: "briefcase", title: "Corporate shows", line: "Performances for award nights, launches, annual days and conferences.", look: "Corporate show" },
      { icon: "users", title: "Employee performances", line: "We choreograph and rehearse your team for their own act.", look: "Corporate show" }
    ] },
    { id: "special", label: "Theme acts", image: "corporate/stage-events/siwpc-classical-opening-act/poster.jpg", items: [
      { icon: "mask", title: "Theme acts", line: "Peacock, Ram & Sita, retro Bollywood, classical and other themed acts.", look: "Theme act / Special entry" },
      { icon: "spark", title: "Big celebrations", line: "Larger productions for big weddings and milestone events.", look: "Something else" }
    ] }
  ],

  faq: [
    { q: "How early should we book?", a: "As early as you can. November to February is wedding season, and dates go quickly." },
    { q: "Do you travel outside Hyderabad?", a: "Yes, we travel across India for weddings and events." },
    { q: "Can you do something custom for us?", a: "Yes. Tell us about your theme, music and venue, and we’ll come back with an idea." },
    { q: "Can you teach our family for the sangeet?", a: "Yes. Our choreographers rehearse with the couple and family until everyone is comfortable on stage." },
    { q: "Do you also handle props, lights and music?", a: "Yes. We can take care of props, stage setup, lighting, VJ and music editing." },
    { q: "How much does it cost?", a: "It depends on the act, the number of dancers, the city and the production. Send us your details on WhatsApp and we’ll share a quote." },
    { q: "Can you work with our planner?", a: "Of course. We regularly work with event companies like Ishte Events, Pink Pagdi and Swastik Events." }
  ],

  troupe: [
    { src: "brand/team/troupe-01.jpg", ar: 0.796 }, { src: "brand/team/troupe-02.jpg", ar: 1.352 },
    { src: "brand/team/troupe-03.jpg", ar: 1.333 }, { src: "brand/team/troupe-04.jpg", ar: 0.796 },
    { src: "brand/team/troupe-05.jpg", ar: 0.75 }, { src: "brand/team/troupe-06.jpg", ar: 1.352 },
    { src: "brand/team/troupe-07.jpg", ar: 1.333 }, { src: "brand/team/troupe-08.jpg", ar: 0.75 },
    { src: "brand/team/troupe-09.jpg", ar: 1.333 }, { src: "brand/team/troupe-10.jpg", ar: 1.333 }
  ],

  enquiry: {
    looking: [
      { group: "Entries", items: ["Bridal entry", "Groom entry", "Couple / Varmala entry", "Theme act / Special entry"] },
      { group: "Performances", items: ["Sangeet performance", "Mehendi performance", "Reception act", "Couple choreography", "Family choreography", "Background dancers", "Corporate show"] },
      { group: "Production", items: ["Props & special effects", "Lighting & VJ", "Music editing", "Something else"] }
    ],
    eventTypes: ["Wedding", "Sangeet", "Mehendi", "Reception", "Engagement", "Corporate", "Other"],
    cities: ["Hyderabad", "Bangalore", "Udaipur", "Jaipur", "Other"],
    guests: ["Under 200", "200–500", "500–1,000", "1,000+"],
    lighting: ["Warm & royal", "Colourful party", "Dramatic stage", "Not sure"],
    greeting: "Hi Bosco Dance Company! I'd like to enquire about a performance.",
    signature: "(Sent from boscodancecompany.com)"
  }
};
