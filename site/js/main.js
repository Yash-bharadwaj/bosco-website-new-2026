/* Bosco Dance Company · interactions (no dependencies) */
(() => {
  "use strict";

  const D = window.BDC;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const M = (p) => (/^https?:/.test(p) ? p : D.config.mediaBase + p);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const use = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };
  const play = (v) => { if (v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } };
  const lazySrc = (v) => { if (v && !v.src && v.dataset.src) { v.src = v.dataset.src; } };

  const ui = { dialogs: 0 };
  const lock = (on) => { ui.dialogs = Math.max(0, ui.dialogs + (on ? 1 : -1)); root.classList.toggle("is-locked", ui.dialogs > 0); document.dispatchEvent(new CustomEvent("bdc:dialogs", { detail: ui.dialogs })); };

  // Fix relative media paths written in HTML (posters, data-src) to mediaBase when it changes.
  if (D.config.mediaBase !== "media/") {
    $$("[src^='media/'],[poster^='media/'],[data-src^='media/'],[data-src-wide^='media/'],[data-src-tall^='media/']").forEach((el) => {
      ["src", "poster", "data-src", "data-src-wide", "data-src-tall"].forEach((a) => {
        const v = el.getAttribute(a); if (v && v.startsWith("media/")) el.setAttribute(a, D.config.mediaBase + v.slice(6));
      });
    });
  }

  /* ---------------------------------------------------------- Theme */
  const themeBtn = $("[data-theme-toggle]");
  const metaTheme = $('meta[name="theme-color"]');
  const setTheme = (t) => {
    root.dataset.theme = t;
    metaTheme.content = t === "dark" ? "#0C0B0A" : "#FAF7F2";
    themeBtn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    safe(() => localStorage.setItem("bdc-theme", t));
  };
  setTheme(root.dataset.theme === "dark" ? "dark" : "light");
  themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition || reduced.matches) return setTheme(next);
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  });

  /* ---------------------------------------------------------- Nav + menu */
  const nav = $("[data-nav]");
  const menu = $("[data-menu]");
  const menuBtn = $("[data-menu-open]");
  let lastY = scrollY;
  const openMenu = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    lock(open);
    if (open) $("[data-menu-close]").focus(); else menuBtn.focus({ preventScroll: true });
  };
  menuBtn.addEventListener("click", () => openMenu(true));
  $("[data-menu-close]").addEventListener("click", () => openMenu(false));
  $$("[data-menu-link]").forEach((a) => a.addEventListener("click", () => openMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) openMenu(false); });

  const navLinks = $$(".nav__links a");
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["work", "bosco", "services", "faq", "contact"].forEach((id) => { const s = document.getElementById(id); if (s) sectionObs.observe(s); });

  /* ---------------------------------------------------------- Reveal */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  const observeReveals = (scope = document) => $$(".reveal:not(.in)", scope).forEach((el) => revealObs.observe(el));

  /* ---------------------------------------------------------- Hero */
  const heroStage = $("[data-hero-stage]");
  const heroVideo = $("[data-hero-video]");
  const heroToggle = $("[data-hero-toggle]");
  const tallMQ = matchMedia("(max-width: 699px)");
  const hero = { userPaused: reduced.matches, inView: true };
  const heroSync = () => {
    const src = tallMQ.matches ? heroVideo.dataset.srcTall : heroVideo.dataset.srcWide;
    if (heroVideo.dataset.current !== src) { heroVideo.dataset.current = src; heroVideo.src = src; }
    const shouldPlay = !hero.userPaused && hero.inView && ui.dialogs === 0;
    if (shouldPlay) play(heroVideo); else heroVideo.pause();
    heroToggle.dataset.paused = String(hero.userPaused);
    heroToggle.setAttribute("aria-label", hero.userPaused ? "Play showreel" : "Pause showreel");
  };
  heroToggle.addEventListener("click", () => { hero.userPaused = !hero.userPaused; heroSync(); });
  tallMQ.addEventListener("change", heroSync);
  new IntersectionObserver(([en]) => { hero.inView = en.isIntersecting; heroSync(); }, { threshold: 0.05 }).observe(heroStage);
  heroSync();

  /* ---------------------------------------------------------- Scroll-linked effects (one rAF loop) */
  const steps = $("[data-steps]");
  const parallaxEls = $$("[data-parallax]");
  const mobileBar = $("[data-mobile-bar]");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    if (menu.hidden) nav.classList.toggle("is-hidden", y > lastY && y > 480);
    lastY = y;
    if (!reduced.matches) {
      const start = Math.max(1, heroStage.offsetTop - (nav.offsetHeight + 12));
      heroStage.style.setProperty("--p", clamp(y / start, 0, 1).toFixed(4));
      parallaxEls.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        el.style.setProperty("--py", ((r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax)).toFixed(1) + "px");
      });
    }
    if (steps) {
      const r = steps.getBoundingClientRect();
      steps.style.setProperty("--progress", clamp((innerHeight * 0.55 - r.top) / r.height, 0, 1).toFixed(4));
    }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll, { passive: true });

  /* ---------------------------------------------------------- Marquees */
  const troupeTrack = $("[data-troupe]");
  troupeTrack.innerHTML = D.troupe.map((p) => `<li style="--ar:${p.ar}"><img src="${M(p.src)}" alt="Bosco Dance Company dancers" loading="lazy" decoding="async" /></li>`).join("");
  // partner names: listed twice so one copy is always wider than the screen, then doubled below for the loop
  const partnersTrack = $("[data-partners]");
  partnersTrack.innerHTML = [...D.partners, ...D.partners].map((p, i) =>
    `<li${i >= D.partners.length ? ' aria-hidden="true"' : ""}>${esc(p.name)}</li>`).join("");
  $$(".marquee__track").forEach((track) => {
    [...track.children].forEach((li) => { const c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); $$("img", c).forEach((i) => (i.alt = "")); track.appendChild(c); });
  });

  // the chosen filter (entries / sangeet / spectacle / corporate) pre-selects options in the enquiry form
  const state = { intent: null, filter: "all" };

  /* ---------------------------------------------------------- Work carousel */
  const carousel = $("[data-carousel]");
  const track = $("[data-track]");
  const dotsEl = $("[data-dots]");
  const autoBtn = $("[data-autoplay-toggle]");
  const filterBtns = $$("[data-filter]");
  const C = { list: [], active: 0, elapsed: 0, last: 0, paused: reduced.matches, hold: false, inView: false, programmatic: false, holdTimer: 0, scrollTimer: 0 };

  const cardHTML = (w, i, n) => `
    <li class="carousel__item" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">
      <button class="card${w.loop ? "" : " no-loop"}" type="button" data-index="${i}" aria-label="Watch ${esc(w.title)}">
        <img class="card__media card__poster" src="${M(w.poster)}" alt="" loading="${i < 3 ? "eager" : "lazy"}" decoding="async" />
        ${w.loop ? `<video class="card__media card__video" muted playsinline loop preload="none" data-src="${M(w.loop)}"></video>` : ""}
        ${w.credit ? `<span class="card__credit">${esc(w.credit)}</span>` : ""}
        <img class="wm" src="${M(D.brand.watermark)}" alt="" aria-hidden="true" loading="lazy" />
        <span class="card__body">
          <span class="card__eyebrow">${esc(w.eyebrow)}</span>
          <span class="card__title">${esc(w.title)}</span>
          <span class="card__chip">${use("i-play")}Watch</span>
        </span>
      </button>
    </li>`;
  const emptyHTML = (f) => {
    const e = D.emptyStates[f];
    return `<li class="carousel__item"><div class="empty-card"><p class="display">${esc(e.title)}</p><p>${esc(e.line)}</p>
      <button class="btn btn--primary" type="button" data-enquire data-looking="${esc(e.looking)}" data-source="work-empty">${use("i-wa")}${esc(e.cta)}</button></div></li>`;
  };

  const items = () => $$(".carousel__item", track);
  const edgePad = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;

  function renderCards(first) {
    const f = state.filter;
    C.list = f === "all" ? D.works : D.works.filter((w) => w.cats.includes(f));
    const paint = () => {
      track.innerHTML = C.list.length ? C.list.map((w, i) => cardHTML(w, i, C.list.length)).join("") : (D.emptyStates[f] ? emptyHTML(f) : "");
      dotsEl.innerHTML = C.list.map(() => `<span class="dot-pill"><i></i></span>`).join("");
      C.programmatic = true; carousel.scrollLeft = 0; setTimeout(() => (C.programmatic = false), 60);
      setActive(0);
      requestAnimationFrame(() => track.classList.remove("is-swapping"));
    };
    if (first) return paint();
    track.classList.add("is-swapping");
    setTimeout(paint, 220);
  }

  function setActive(i) {
    C.active = i; C.elapsed = 0;
    $$(".card", track).forEach((card, k) => {
      const on = k === i;
      card.classList.toggle("is-active", on);
      const v = $("video", card);
      if (!v) return;
      if (on && C.inView && ui.dialogs === 0) {
        lazySrc(v);
        v.onplaying = () => card.classList.add("is-playing");
        play(v);
      } else { v.pause(); card.classList.remove("is-playing"); }
      if (k === i + 1) { lazySrc(v); v.preload = "metadata"; }
    });
    $$(".dot-pill", dotsEl).forEach((d, k) => { d.classList.toggle("is-active", k === i); d.style.setProperty("--fill", k < i ? 0 : 0); });
  }

  function goTo(i, smooth = true) {
    const its = items(); if (!its.length) return;
    i = (i + its.length) % its.length;
    const target = its[i].offsetLeft - edgePad();
    C.programmatic = true; clearTimeout(C.scrollTimer);
    carousel.scrollTo({ left: target, behavior: smooth && !reduced.matches ? "smooth" : "auto" });
    C.scrollTimer = setTimeout(() => (C.programmatic = false), 700);
    setActive(i);
  }
  const next = () => goTo(C.active + 1);
  const prev = () => goTo(C.active - 1);
  $("[data-next]").addEventListener("click", () => { holdFor(5000); next(); });
  $("[data-prev]").addEventListener("click", () => { holdFor(5000); prev(); });
  autoBtn.addEventListener("click", () => {
    C.paused = !C.paused;
    autoBtn.dataset.paused = String(C.paused);
    autoBtn.setAttribute("aria-label", C.paused ? "Play slideshow" : "Pause slideshow");
  });
  autoBtn.dataset.paused = String(C.paused);

  function holdFor(ms) { C.hold = true; clearTimeout(C.holdTimer); C.holdTimer = setTimeout(() => (C.hold = false), ms); }
  carousel.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { C.hold = true; clearTimeout(C.holdTimer); } });
  carousel.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") holdFor(600); });
  carousel.addEventListener("touchstart", () => holdFor(6000), { passive: true });
  carousel.addEventListener("focusin", () => { C.hold = true; clearTimeout(C.holdTimer); });
  carousel.addEventListener("focusout", () => holdFor(3000));
  carousel.addEventListener("scroll", () => {
    if (C.programmatic) return;
    holdFor(4000);
    clearTimeout(C.scrollTimer);
    C.scrollTimer = setTimeout(() => {
      const its = items(); if (!its.length) return;
      const x = carousel.scrollLeft + edgePad();
      const max = carousel.scrollWidth - carousel.clientWidth - 2;
      let best = 0, bestD = Infinity;
      its.forEach((it, k) => { const d = Math.abs(it.offsetLeft - x); if (d < bestD) { bestD = d; best = k; } });
      if (carousel.scrollLeft >= max && best < its.length - 1 && C.active > best) best = C.active;
      if (best !== C.active) setActive(best);
    }, 120);
  }, { passive: true });

  new IntersectionObserver(([en]) => { C.inView = en.isIntersecting; setActive(C.active); }, { threshold: 0.35 }).observe(carousel);

  const tick = (t) => {
    const dt = C.last ? t - C.last : 0; C.last = t;
    const running = C.inView && !C.paused && !C.hold && ui.dialogs === 0 && document.visibilityState === "visible" && C.list.length > 1;
    if (running) C.elapsed += dt;
    const dot = dotsEl.children[C.active];
    if (dot) dot.style.setProperty("--fill", clamp(C.elapsed / D.config.slideMs, 0, 1).toFixed(3));
    if (C.elapsed >= D.config.slideMs) next();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  function setFilter(f) {
    if (!filterBtns.some((b) => b.dataset.filter === f)) f = "all";
    state.filter = f;
    state.intent = f === "all" ? null : f;
    filterBtns.forEach((b) => { const on = b.dataset.filter === f; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
    renderCards(false);
  }
  filterBtns.forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));
  track.addEventListener("click", (e) => { const card = e.target.closest(".card"); if (card) openFilm(+card.dataset.index); });
  renderCards(true);

  /* ---------------------------------------------------------- Film player */
  const film = $("[data-film]");
  const filmFrame = $("[data-film-frame]");
  const F = { i: 0, list: [], from: null };
  const wmHTML = () => `<img class="wm" src="${M(D.brand.watermark)}" alt="" aria-hidden="true" />`;
  function paintFilm() {
    const w = F.list[F.i]; if (!w) return;
    $$("[data-film-prev],[data-film-next]").forEach((b) => (b.hidden = F.list.length < 2));
    $("[data-film-eyebrow]").textContent = w.eyebrow + (w.credit ? " · " + w.credit : "");
    $("[data-film-title]").textContent = w.title;
    $("[data-film-book-label]").textContent = w.bookLabel || "Book this";
    const ar = w.film.ar || 16 / 9;
    filmFrame.style.setProperty("--ar", String(ar));
    filmFrame.classList.toggle("is-wide", ar >= 1);
    film.classList.toggle("is-wide-film", ar >= 1); // phones in portrait get a "turn your phone" hint
    filmFrame.style.animation = "none"; void filmFrame.offsetWidth; filmFrame.style.animation = "";
    if (w.film.type === "mp4") {
      filmFrame.innerHTML = `<video controls autoplay playsinline preload="auto" src="${M(w.film.src)}" poster="${M(w.poster)}"></video>`;
      // start it inside the tap itself, so phones allow playback with sound
      play($("video", filmFrame));
    } else { // "drive": Google Drive preview player
      filmFrame.innerHTML = `<iframe src="https://drive.google.com/file/d/${esc(w.film.id)}/preview" title="${esc(w.title)}" allow="autoplay; fullscreen"></iframe>`;
    }
    if (w.wm !== false) filmFrame.insertAdjacentHTML("beforeend", wmHTML()); // skip when the video already carries the logo
  }
  // list defaults to the carousel's current cards; `from` is the element to refocus on close
  function openFilm(i, list = C.list, from = null) {
    F.i = i; F.list = list; F.from = from; paintFilm();
    if (!film.open) { film.showModal(); lock(true); }
    $("#film-title").focus({ preventScroll: true });
  }
  const closeFilm = () => film.close();
  film.addEventListener("close", () => {
    filmFrame.innerHTML = ""; lock(false);
    const c = F.from || (F.list === C.list ? $$(".card", track)[F.i] : null);
    if (c) c.focus({ preventScroll: true });
  });
  $("[data-film-close]").addEventListener("click", closeFilm);
  $("[data-film-prev]").addEventListener("click", () => { F.i = (F.i - 1 + F.list.length) % F.list.length; paintFilm(); });
  $("[data-film-next]").addEventListener("click", () => { F.i = (F.i + 1) % F.list.length; paintFilm(); });
  film.addEventListener("keydown", (e) => {
    if (e.target.closest("video,iframe")) return;
    if (e.key === "ArrowRight") $("[data-film-next]").click();
    if (e.key === "ArrowLeft") $("[data-film-prev]").click();
  });
  $("[data-film-book]").addEventListener("click", () => {
    const w = F.list[F.i]; closeFilm();
    if (!w.book) return openSheet({ source: "film-" + w.slug });
    openSheet({ looking: [w.book], inspired: { title: w.title, poster: M(w.poster) }, source: "film" });
  });

  /* ---------------------------------------------------------- Bosco at work (video card on the portrait) */
  const reel = $("[data-bosco-reel]");
  const reelVideo = $("video", reel);
  const R = { inView: false };
  const reelSync = () => { if (R.inView && ui.dialogs === 0 && !reduced.matches) { lazySrc(reelVideo); play(reelVideo); } else reelVideo.pause(); };
  new IntersectionObserver(([en]) => { R.inView = en.isIntersecting; reelSync(); }, { threshold: 0.3 }).observe(reel);
  reel.addEventListener("click", () => openFilm(0, [D.bosco], reel));

  /* ---------------------------------------------------------- Bosco's vision: the Shiva entry as a muted loop */
  const vFrame = $("[data-vision]");
  const vSound = $("[data-vision-sound]");
  const V = D.vision;
  const VS = { video: null, inView: false, muted: true };
  // AV1 where the browser can decode it (smaller), H.264 everywhere else
  const vSrc = () => {
    const t = document.createElement("video");
    return V.av1 && t.canPlayType('video/mp4; codecs="av01.0.04M.08, mp4a.40.2"') === "probably" ? V.av1 : V.src;
  };
  const vSync = () => {
    if (!VS.video) return;
    if (VS.inView && ui.dialogs === 0 && !reduced.matches && document.visibilityState === "visible") play(VS.video);
    else VS.video.pause();
  };
  if (vFrame && V) {
    // create the video only as the section approaches
    new IntersectionObserver(([en], o) => {
      if (!en.isIntersecting) return;
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.poster = M(V.poster);
      v.src = M(vSrc());
      v.addEventListener("playing", () => vFrame.classList.add("is-playing"));
      $(".vision__player", vFrame).replaceChildren(v);
      VS.video = v; vSync();
      o.disconnect();
    }, { rootMargin: "600px" }).observe(vFrame);
    new IntersectionObserver(([en]) => { VS.inView = en.isIntersecting; vSync(); }, { threshold: 0.25 }).observe(vFrame);
    vSound.addEventListener("click", () => {
      VS.muted = !VS.muted;
      vSound.dataset.muted = String(VS.muted);
      vSound.setAttribute("aria-label", VS.muted ? "Turn sound on" : "Turn sound off");
      if (VS.video) VS.video.muted = VS.muted;
    });
    $("[data-vision-open]").addEventListener("click", () => openFilm(0, [{
      slug: V.slug, title: V.title, eyebrow: V.eyebrow, poster: V.poster,
      film: { type: "mp4", src: vSrc(), ar: 16 / 9 }, book: V.book, bookLabel: V.bookLabel
    }], vFrame));
  }

  /* ---------------------------------------------------------- Process steps */
  const stepEls = $$(".step", steps);
  const visuals = $$("[data-visual]");
  const processMedia = $("[data-process-media]");
  const P = { step: 0, inView: false };
  const stepVideos = visuals.map((v) => $("video", v));
  // play only the active step's video, and only while the frame is on screen with no pop-up open
  const pSync = () => {
    const on = P.inView && ui.dialogs === 0 && !reduced.matches && document.visibilityState === "visible";
    stepVideos.forEach((vid, k) => {
      if (!vid) return;
      if (k === P.step && on) {
        lazySrc(vid);
        const p = vid.play();
        // not buffered yet: try again as soon as it can play
        if (p && p.catch) p.catch(() => vid.addEventListener("canplay", () => { if (P.step === k && P.inView) play(vid); }, { once: true }));
      } else vid.pause();
    });
  };
  const setStep = (i) => {
    if (i < 0) return;
    const changed = i !== P.step;
    P.step = i;
    stepEls.forEach((s, k) => s.classList.toggle("is-active", k === i));
    processMedia.classList.toggle("is-chat", i === 0);
    visuals.forEach((v, k) => v.classList.toggle("is-active", k === i));
    const vid = stepVideos[i];
    if (vid && changed && vid.readyState > 0) vid.currentTime = 0; // each step starts its clip from the beginning
    pSync();
  };
  // load all step clips as the section approaches, so switching steps never waits on the network
  new IntersectionObserver(([en], o) => {
    if (!en.isIntersecting) return;
    stepVideos.forEach((vid) => { if (vid) { vid.preload = "auto"; lazySrc(vid); } });
    o.disconnect();
  }, { rootMargin: "800px 0px" }).observe(processMedia);
  new IntersectionObserver(([en]) => { P.inView = en.isIntersecting; pSync(); }, { threshold: 0.2 }).observe(processMedia);
  document.addEventListener("bdc:dialogs", pSync);
  document.addEventListener("visibilitychange", pSync);
  const mobileMQ = matchMedia("(max-width: 899px)");
  let stepObs;
  const watchSteps = () => {
    if (stepObs) stepObs.disconnect();
    stepObs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setStep(stepEls.indexOf(en.target)); });
    }, { rootMargin: mobileMQ.matches ? "-62% 0px -30% 0px" : "-46% 0px -46% 0px" });
    stepEls.forEach((s) => stepObs.observe(s));
  };
  watchSteps(); mobileMQ.addEventListener("change", watchSteps);

  /* ---------------------------------------------------------- Counters */
  const fmt = (n, comma) => (comma ? n.toLocaleString("en-IN") : String(n));
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countObs.unobserve(en.target);
      $$("[data-count]", en.target).forEach((el) => {
        const to = +el.dataset.count, comma = el.dataset.format === "comma";
        if (reduced.matches) return void (el.textContent = fmt(to, comma));
        const t0 = performance.now(), dur = 1600;
        const step = (t) => {
          const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(Math.round(to * e), comma);
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = "0"; requestAnimationFrame(step);
      });
    });
  }, { threshold: 0.4 });
  const statsEl = $("[data-stats]"); if (statsEl) countObs.observe(statsEl);

  /* ---------------------------------------------------------- Services */
  const ICONS = {
    crown: '<path d="M4 17h16l1-10-5 4-4-6-4 6-5-4 1 10Z"/><path d="M5 20h14"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    star: '<path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6L12 3Z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.7.6 2.8 2.4 3 5.2"/>',
    box: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    light: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/>',
    wave: '<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5h6v2M3 12h18"/>',
    mask: '<path d="M4 6c5-2 11-2 16 0v5c0 5-3.6 9-8 9s-8-4-8-9V6Z"/><path d="M8.5 11h2M13.5 11h2M9.5 15.5c1.5 1 3.5 1 5 0"/>',
    spark: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/><path d="M19 17v4M17 19h4"/>'
  };
  const svgIcon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.spark}</svg>`;
  const tabs = $("[data-service-tabs]");
  const bento = $("[data-bento]");
  tabs.innerHTML = D.services.map((g, i) => `<button class="chip${i ? "" : " is-active"}" type="button" role="tab" id="tab-${g.id}" aria-controls="bento" aria-selected="${!i}" tabindex="${i ? -1 : 0}" data-group="${g.id}">${esc(g.label)}</button>`).join("");
  bento.id = "bento"; bento.setAttribute("role", "tabpanel");
  const paintBento = (g) => {
    bento.className = "bento " + (g.items.length >= 3 ? "bento--4" : "bento--2");
    bento.setAttribute("aria-labelledby", "tab-" + g.id);
    bento.innerHTML = g.items.map((it, i) => `
      <article class="svc${i === 0 ? " svc--feature" : ""}" style="--i:${i}">
        ${i === 0 ? `<img src="${M(g.image)}" alt="" loading="lazy" decoding="async" />` : ""}
        <span class="svc__icon">${svgIcon(it.icon)}</span>
        <h3 class="svc__title">${esc(it.title)}</h3>
        <p class="svc__line">${esc(it.line)}</p>
        <button class="svc__cta" type="button" data-enquire data-looking="${esc(it.look)}" data-source="services">Enquire ${use("i-arrow")}</button>
      </article>`).join("");
  };
  const selectTab = (btn, focus) => {
    $$("[role=tab]", tabs).forEach((b) => { const on = b === btn; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    if (focus) btn.focus();
    const g = D.services.find((x) => x.id === btn.dataset.group);
    bento.classList.add("is-swapping");
    setTimeout(() => { paintBento(g); bento.classList.remove("is-swapping"); }, reduced.matches ? 0 : 200);
  };
  tabs.addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b && b.getAttribute("aria-selected") !== "true") selectTab(b); });
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const all = $$("[role=tab]", tabs), cur = all.indexOf(document.activeElement);
    let n = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : cur + (e.key === "ArrowRight" ? 1 : -1);
    n = (n + all.length) % all.length; e.preventDefault(); selectTab(all[n], true);
  });
  paintBento(D.services[0]);

  /* ---------------------------------------------------------- FAQ */
  const acc = $("[data-accordion]");
  acc.innerHTML = D.faq.map((f, i) => `
    <div class="qa${i === 0 ? " is-open" : ""} reveal" style="--d:${(i * 0.04).toFixed(2)}s">
      <h3><button class="qa__q" type="button" id="qb-${i}" aria-expanded="${i === 0}" aria-controls="qa-${i}">${esc(f.q)}<span class="qa__icon">${use("i-plus")}</span></button></h3>
      <div class="qa__a" id="qa-${i}" role="region" aria-labelledby="qb-${i}"${i === 0 ? "" : " inert"}><div>
        <p>${esc(f.a)}</p>
        <button class="text-link" type="button" data-enquire data-question="${esc(f.q)}" data-source="faq">Ask on WhatsApp ${use("i-arrow")}</button>
      </div></div>
    </div>`).join("");
  acc.addEventListener("click", (e) => {
    const q = e.target.closest(".qa__q"); if (!q) return;
    const item = q.closest(".qa"), open = !item.classList.contains("is-open");
    $$(".qa", acc).forEach((x) => { const on = x === item && open; x.classList.toggle("is-open", on); $(".qa__q", x).setAttribute("aria-expanded", String(on)); $(".qa__a", x).inert = !on; });
  });

  /* ---------------------------------------------------------- Lazy map + CTA video */
  const mapFrame = $("[data-map] iframe");
  new IntersectionObserver(([en], o) => { if (en.isIntersecting) { mapFrame.src = mapFrame.dataset.src; o.disconnect(); } }, { rootMargin: "400px" }).observe(mapFrame);
  const ctaVideo = $(".cta__video");
  if (!reduced.matches) {
    new IntersectionObserver(([en]) => { if (en.isIntersecting && ui.dialogs === 0) { lazySrc(ctaVideo); play(ctaVideo); } else ctaVideo.pause(); }, { threshold: 0.2 }).observe(ctaVideo);
  }

  /* ---------------------------------------------------------- Floating button + mobile bar */
  const fab = $("[data-fab]"), tip = $("[data-fab-tip]");
  if (!safe(() => sessionStorage.getItem("bdc-tip"))) {
    setTimeout(() => { if (ui.dialogs) return; tip.classList.add("is-shown"); safe(() => sessionStorage.setItem("bdc-tip", "1")); setTimeout(() => tip.classList.remove("is-shown"), 6000); }, 8000);
  }
  const bar = { heroGone: false, footer: false };
  const paintBar = () => mobileBar.classList.toggle("is-visible", bar.heroGone && !bar.footer && ui.dialogs === 0);
  new IntersectionObserver(([en]) => { bar.heroGone = !en.isIntersecting && en.boundingClientRect.top < 0; paintBar(); }).observe($(".hero__actions"));
  new IntersectionObserver(([en]) => { bar.footer = en.isIntersecting; paintBar(); }, { rootMargin: "0px 0px 120px 0px" }).observe($("#book"));
  document.addEventListener("bdc:dialogs", (e) => {
    fab.classList.toggle("is-hidden", e.detail > 0); paintBar(); heroSync(); setActive(C.active);
    if (e.detail > 0) ctaVideo.pause();
    reelSync();
    vSync();
  });

  /* ---------------------------------------------------------- Enquiry sheet → WhatsApp */
  const sheet = $("[data-sheet]");
  const form = $("[data-sheet-form]");
  const E = D.enquiry;
  const S = { step: 1, sent: false, inspired: null, question: null, source: "" };
  const DRAFT = "bdc-enquiry";

  $("[data-looking-groups]").innerHTML = E.looking.map((g) => `
    <div class="look-group"><p class="look-group__title">${esc(g.group)}</p><div class="chips">
      ${g.items.map((x) => `<label class="chip"><input type="checkbox" name="looking" value="${esc(x)}" /><span>${esc(x)}</span></label>`).join("")}
    </div></div>`).join("");
  const radios = (sel, name, list) => ($(sel).innerHTML = list.map((x) => `<label class="chip"><input type="radio" name="${name}" value="${esc(x)}" /><span>${esc(x)}</span></label>`).join(""));
  radios("[data-event-types]", "eventType", E.eventTypes);
  radios("[data-guests]", "guests", E.guests);
  radios("[data-lighting]", "lighting", E.lighting);
  const cityInput = $("[data-city]");
  $("[data-city-chips]").innerHTML = E.cities.map((c) => `<button class="chip" type="button" data-city-chip="${esc(c)}">${esc(c)}</button>`).join("");
  $("[data-city-chips]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-city-chip]"); if (!b) return;
    const v = b.dataset.cityChip;
    cityInput.value = v === "Other" ? "" : v; cityInput.focus();
    $$("[data-city-chip]").forEach((x) => x.classList.toggle("is-active", x === b && v !== "Other"));
    saveDraft();
  });
  cityInput.addEventListener("input", () => $$("[data-city-chip]").forEach((x) => x.classList.toggle("is-active", x.dataset.cityChip === cityInput.value)));
  // Radios behave like toggles (tap again to clear)
  form.addEventListener("click", (e) => {
    const input = e.target.closest("label.chip")?.querySelector("input[type=radio]");
    if (!input || e.target !== input) return;
    if (input.dataset.was === "1") { input.checked = false; input.dataset.was = ""; saveDraft(); }
    else { $$(`input[name="${input.name}"]`, form).forEach((r) => (r.dataset.was = "")); input.dataset.was = "1"; }
  });

  $$("[data-stepper]").forEach((st) => {
    const out = $("[data-step-value]", st), min = +(st.dataset.min ?? 1), max = st.dataset.stepper === "days" ? 7 : 20;
    const set = (v) => { out.value = out.textContent = String(clamp(v, min, max)); saveDraft(); };
    $("[data-step-dec]", st).addEventListener("click", () => set(+out.textContent - 1));
    $("[data-step-inc]", st).addEventListener("click", () => set(+out.textContent + 1));
  });
  const dateInput = $("[data-date]"), tbd = $("[data-date-tbd]");
  dateInput.min = new Date().toISOString().slice(0, 10);
  tbd.addEventListener("change", () => { dateInput.disabled = tbd.checked; if (tbd.checked) dateInput.value = ""; });

  const stepsEls = $$("[data-sheet-step]");
  const btn = { back: $("[data-sheet-back]"), skip: $("[data-sheet-skip]"), next: $("[data-sheet-next]"), send: $("[data-sheet-send]"), fine: $("[data-sheet-fine]"), doneClose: $("[data-sheet-done-close]") };
  const lookErr = $("[data-looking-error]");
  const body = $("[data-sheet-body]");
  function showStep(n) {
    S.step = n;
    stepsEls.forEach((f) => (f.hidden = +f.dataset.sheetStep !== n));
    $$("[data-sheet-dots] li").forEach((d, k) => d.classList.toggle("is-on", k < n));
    btn.back.hidden = n === 1; btn.skip.hidden = n !== 2;
    btn.next.hidden = n === 3; btn.send.hidden = btn.fine.hidden = n !== 3;
    btn.doneClose.hidden = true;
    $("[data-sheet-done]").hidden = true;
    $("[data-inspired]").hidden = !S.inspired || n !== 1;
    body.scrollTop = 0;
  }
  const looking = () => $$('input[name="looking"]:checked', form).map((i) => i.value);
  btn.next.addEventListener("click", () => {
    if (S.step === 1 && !looking().length && !S.question && !S.inspired) {
      lookErr.hidden = false;
      // the message sits under the chips, often below the fold on phones: bring it into view and nudge the button
      lookErr.scrollIntoView({ block: "nearest", behavior: reduced.matches ? "auto" : "smooth" });
      btn.next.classList.remove("is-nudge"); void btn.next.offsetWidth; btn.next.classList.add("is-nudge");
      return;
    }
    lookErr.hidden = true; showStep(S.step + 1);
    const first = $(`[data-sheet-step="${S.step}"] input:not([type=radio]):not([type=checkbox]), [data-sheet-step="${S.step}"] .chip input`, form);
    if (first && finePointer.matches) first.focus({ preventScroll: true });
  });
  btn.back.addEventListener("click", () => showStep(S.step - 1));
  btn.skip.addEventListener("click", () => showStep(3));
  form.addEventListener("change", (e) => { if (e.target.name === "looking") lookErr.hidden = true; saveDraft(); });
  form.addEventListener("input", saveDraft);

  function readForm() {
    const fd = new FormData(form), v = (k) => (fd.get(k) || "").toString().trim();
    return {
      looking: looking(), eventType: v("eventType"), date: dateInput.disabled ? "" : v("date"), tbd: tbd.checked,
      days: +$('[data-stepper="days"] output').textContent, city: v("city"), venue: v("venue"), guests: v("guests"),
      name: v("name"), eventName: v("eventName"), perfCount: +$('[data-stepper="perfCount"] output').textContent,
      schedule: v("schedule"), specialEntries: v("specialEntries"), theme: v("theme"), decorNotes: v("decorNotes"),
      lighting: v("lighting"), refLink: v("refLink"), willShareMedia: fd.get("willShareMedia") === "on", notes: v("notes")
    };
  }
  function saveDraft() { if (!S.sent) safe(() => sessionStorage.setItem(DRAFT, JSON.stringify({ ...readForm(), inspired: S.inspired, question: S.question }))); }
  function applyDraft(d) {
    if (!d) return;
    $$('input[name="looking"]', form).forEach((i) => (i.checked = d.looking.includes(i.value)));
    ["eventType", "guests", "lighting"].forEach((n) => $$(`input[name="${n}"]`, form).forEach((i) => (i.checked = i.value === d[n])));
    ["city", "venue", "name", "eventName", "schedule", "specialEntries", "theme", "decorNotes", "refLink", "notes"].forEach((n) => (form.elements[n].value = d[n] || ""));
    dateInput.value = d.date || ""; tbd.checked = !!d.tbd; dateInput.disabled = tbd.checked;
    $('[data-stepper="days"] output').textContent = d.days || 1;
    $('[data-stepper="perfCount"] output').textContent = d.perfCount || 0;
    form.elements.willShareMedia.checked = !!d.willShareMedia;
    S.inspired = d.inspired || null; S.question = d.question || null;
  }

  const cut = (s, n = 300) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  function buildMessage(d) {
    const b = (label, val) => (val ? `*${label}:* ${val}` : null);
    const dateText = d.tbd ? "Not fixed yet" : d.date ? new Date(d.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
    const lines = [
      E.greeting, "",
      b("Looking for", d.looking.join(", ")),
      b("Inspired by", S.inspired && S.inspired.title),
      b("Question about", S.question), "",
      b("Event", [d.eventName, d.eventType && (d.eventName ? `(${d.eventType})` : d.eventType)].filter(Boolean).join(" ")),
      b("Date", [dateText, dateText && d.days > 1 ? `${d.days} days` : ""].filter(Boolean).join(" · ")),
      b("City / venue", [d.city, d.venue].filter(Boolean).join(", ")),
      b("Guests", d.guests),
      b("Name", d.name), "",
      b("Itinerary", [d.perfCount ? `${d.perfCount} performance${d.perfCount > 1 ? "s" : ""}` : "", cut(d.schedule)].filter(Boolean).join(". ")),
      b("Special entries", cut(d.specialEntries, 160)),
      b("Theme & decor", [cut(d.theme, 120), cut(d.decorNotes), d.lighting && `${d.lighting} lighting`].filter(Boolean).join(" · ")),
      b("References", cut(d.refLink, 200)),
      d.notes ? `\n*Notes:* ${cut(d.notes, 400)}` : null, "",
      d.willShareMedia ? "I'll share reference photos/videos here." : null,
      E.signature
    ];
    return lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = readForm();
    const url = `https://wa.me/${D.config.whatsapp}?text=${encodeURIComponent(buildMessage(d))}`;
    $("[data-wa-fallback]").href = url;
    // Phones (incl. Instagram's in-app browser) block or mishandle new tabs; going straight to the
    // wa.me link hands off to the WhatsApp app reliably. Desktops open WhatsApp Web in a new tab.
    if (!finePointer.matches) location.href = url; // same tap = user gesture, so iOS opens the WhatsApp app
    else { const tab = window.open(url, "_blank"); if (tab) tab.opener = null; else location.href = url; }
    if (typeof window.gtag === "function") window.gtag("event", "whatsapp_enquiry", { looking_for: d.looking.join("|"), inspired_by: S.inspired ? S.inspired.title : "", event_type: d.eventType, source_section: S.source });
    S.sent = true; safe(() => sessionStorage.removeItem(DRAFT));
    stepsEls.forEach((f) => (f.hidden = true));
    $("[data-inspired]").hidden = true;
    $("[data-sheet-done]").hidden = false;
    ["back", "skip", "next", "send", "fine"].forEach((k) => (btn[k].hidden = true));
    btn.doneClose.hidden = false; btn.doneClose.focus();
    $$("[data-sheet-dots] li").forEach((x) => x.classList.add("is-on"));
  });

  function resetForm() {
    form.reset(); S.inspired = null; S.question = null; S.sent = false;
    $('[data-stepper="days"] output').textContent = "1"; $('[data-stepper="perfCount"] output').textContent = "0";
    dateInput.disabled = false; $$("[data-city-chip]").forEach((x) => x.classList.remove("is-active")); $("[data-more]").open = false;
  }

  function openSheet({ looking: pre = [], inspired = null, question = null, source = "" } = {}) {
    if (S.sent) resetForm();
    applyDraft(safe(() => JSON.parse(sessionStorage.getItem(DRAFT) || "null")));
    if (pre.length) $$('input[name="looking"]', form).forEach((i) => { if (pre.includes(i.value)) i.checked = true; });
    if (inspired) S.inspired = inspired;
    if (question) S.question = question;
    S.source = source;
    if (S.inspired) { $("[data-inspired-img]").src = S.inspired.poster; $("[data-inspired-title]").textContent = S.inspired.title; }
    lookErr.hidden = true;
    showStep(1);
    if (!sheet.open) { sheet.showModal(); lock(true); }
    $("#sheet-title").focus({ preventScroll: true });
  }
  $("[data-inspired-remove]").addEventListener("click", () => { S.inspired = null; $("[data-inspired]").hidden = true; saveDraft(); });
  $$("[data-sheet-close]").forEach((b) => b.addEventListener("click", () => sheet.close()));
  sheet.addEventListener("close", () => { lock(false); if (S.sent) resetForm(); });
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });

  // swipe down on the sheet header to close (mobile)
  const head = $(".sheet__head");
  let dragY = null;
  head.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") dragY = e.clientY; });
  addEventListener("pointermove", (e) => { if (dragY !== null) { const dy = Math.max(0, e.clientY - dragY); sheet.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  addEventListener("pointerup", (e) => {
    if (dragY === null) return;
    const dy = e.clientY - dragY; dragY = null;
    sheet.style.transition = "transform .3s var(--ease-out)"; sheet.style.transform = "";
    setTimeout(() => (sheet.style.transition = ""), 300);
    if (dy > 90) sheet.close();
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-enquire]"); if (!t) return;
    e.preventDefault();
    if (!menu.hidden) openMenu(false);
    const intent = D.intents.find((x) => x.id === state.intent);
    openSheet({
      looking: t.dataset.looking ? [t.dataset.looking] : (intent ? intent.looking : []),
      question: t.dataset.question || null,
      source: t.dataset.source || ""
    });
  });


  /* ---------------------------------------------------------- Some of our best work: coverflow carousel */
  const scEl = $("[data-showcase]");
  const scMedia = (window.BDC_MEDIA && window.BDC_MEDIA.showcase) || {};
  const canAV1 = (() => { const t = document.createElement("video"); return t.canPlayType('video/mp4; codecs="av01.0.04M.08, mp4a.40.2"') === "probably"; })();
  const scItems = (D.showcase || []).filter((x) => scMedia[x.slug]);
  const SC = { i: 0, offsets: [], inView: false, hold: false, holdTimer: 0, elapsed: 0, last: 0, ms: 9000 };
  let scSync = () => {};
  const scSection = scEl && scEl.closest("section");
  if (scEl && !scItems.length && scSection) scSection.hidden = true; // nothing built yet: keep the page clean
  if (scEl && scItems.length) {
    const scTrack = $("[data-showcase-track]");
    const scDots = $("[data-showcase-dots]");
    const scCap = $("[data-showcase-caption]");
    const srcOf = (m) => M(canAV1 && m.av1 ? m.av1 : m.src);
    scTrack.innerHTML = scItems.map((x, k) => {
      const m = scMedia[x.slug];
      return `<button class="slide" type="button" data-slide="${k}" aria-label="${esc(x.title)}">
        <video muted playsinline loop preload="none" poster="${M(m.poster)}" data-src="${srcOf(m)}"></video>
        <span class="slide__shade"></span>
        <span class="slide__chip">${use("i-play")}Watch full screen</span>
      </button>`;
    }).join("");
    scDots.innerHTML = scItems.map(() => `<span class="dot-pill"><i></i></span>`).join("");
    const slides = $$(".slide", scTrack);
    const n = slides.length;
    const wrap = (o) => { const h = Math.floor(n / 2); while (o > h) o -= n; while (o < -h) o += n; return o; };
    const filmItem = (x) => {
      const m = scMedia[x.slug];
      return { slug: x.slug, title: x.title, eyebrow: x.place, poster: m.poster, credit: "Video: Social Lens", wm: false,
               film: { type: "mp4", src: m.av1 && canAV1 ? m.av1 : m.src, ar: 16 / 9 }, book: x.book, bookLabel: "Book something like this" };
    };
    scSync = () => {
      const on = SC.inView && ui.dialogs === 0 && !reduced.matches && document.visibilityState === "visible";
      slides.forEach((s, k) => { const v = $("video", s); if (k === SC.i && on) { lazySrc(v); play(v); } else v.pause(); });
    };
    const paint = () => {
      slides.forEach((s, k) => {
        const o = wrap(k - SC.i), prev = SC.offsets[k];
        const jump = prev !== undefined && Math.abs(o - prev) > 1; // e.g. wrapping from one side to the other
        if (jump) { s.style.transition = "none"; s.style.opacity = "0"; }
        s.style.transform = `translateX(${o * 84}%) scale(${o === 0 ? 1 : 0.8})`;
        s.style.zIndex = String(10 - Math.abs(o));
        s.classList.toggle("is-active", o === 0);
        s.tabIndex = o === 0 ? 0 : -1;
        s.setAttribute("aria-label", o === 0 ? `Watch ${scItems[k].title} full screen` : `Show ${scItems[k].title}`);
        if (jump) { void s.offsetWidth; s.style.transition = ""; }
        s.style.opacity = Math.abs(o) > 1 ? "0" : o === 0 ? "1" : "0.7";
        SC.offsets[k] = o;
      });
      $$(".dot-pill", scDots).forEach((d, k) => { d.classList.toggle("is-active", k === SC.i); d.style.setProperty("--fill", 0); });
      const x = scItems[SC.i];
      scCap.innerHTML = `<p class="eyebrow">${esc(x.place)}</p>
        <h3 class="showcase__title">${esc(x.title)}</h3>
        <p class="showcase__credits">${esc(x.credits)}</p>
        <div class="showcase__actions">
          <button class="btn btn--primary btn--sm" type="button" data-showcase-watch>${use("i-play")}Watch</button>
          <button class="btn btn--ghost btn--sm" type="button" data-enquire data-looking="${esc(x.book)}" data-source="showcase">${use("i-wa")}Book something like this</button>
        </div>`;
      scCap.style.animation = "none"; void scCap.offsetWidth; scCap.style.animation = "";
      SC.elapsed = 0;
      scSync();
    };
    const go = (k) => { SC.i = (k + n) % n; paint(); };
    const holdFor = (ms) => { SC.hold = true; clearTimeout(SC.holdTimer); SC.holdTimer = setTimeout(() => (SC.hold = false), ms); };
    slides.forEach((s, k) => s.addEventListener("click", () => {
      if (SC.dragged) return;
      if (k === SC.i) openFilm(0, [filmItem(scItems[k])], s); else { holdFor(6000); go(k); }
    }));
    scCap.addEventListener("click", (e) => { if (e.target.closest("[data-showcase-watch]")) openFilm(0, [filmItem(scItems[SC.i])], slides[SC.i]); });
    $("[data-showcase-prev]").addEventListener("click", () => { holdFor(6000); go(SC.i - 1); });
    $("[data-showcase-next]").addEventListener("click", () => { holdFor(6000); go(SC.i + 1); });
    scEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { holdFor(6000); go(SC.i + 1); }
      if (e.key === "ArrowLeft") { holdFor(6000); go(SC.i - 1); }
    });
    scEl.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { SC.hold = true; clearTimeout(SC.holdTimer); } });
    scEl.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") holdFor(800); });
    // swipe
    let sx = null;
    scEl.addEventListener("pointerdown", (e) => { sx = e.clientX; SC.dragged = false; });
    scEl.addEventListener("pointerup", (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 50) { SC.dragged = true; holdFor(6000); go(SC.i + (dx < 0 ? 1 : -1)); setTimeout(() => (SC.dragged = false), 50); }
    });
    new IntersectionObserver(([en]) => { SC.inView = en.isIntersecting; scSync(); }, { threshold: 0.35 }).observe(scEl);
    document.addEventListener("bdc:dialogs", () => scSync());
    const scTick = (t) => {
      const dt = SC.last ? t - SC.last : 0; SC.last = t;
      if (SC.inView && !SC.hold && ui.dialogs === 0 && document.visibilityState === "visible" && !reduced.matches && n > 1) SC.elapsed += dt;
      const dot = scDots.children[SC.i];
      if (dot) dot.style.setProperty("--fill", clamp(SC.elapsed / SC.ms, 0, 1).toFixed(3));
      if (SC.elapsed >= SC.ms) go(SC.i + 1);
      requestAnimationFrame(scTick);
    };
    paint();
    requestAnimationFrame(scTick);
  }

  /* ---------------------------------------------------------- Resume videos when the tab comes back
     (browsers pause muted videos in background tabs) */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    heroSync(); setActive(C.active); reelSync(); vSync(); scSync();
  });

  /* ---------------------------------------------------------- Boot */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  observeReveals();
  onScroll();
  const ready = () => requestAnimationFrame(() => root.classList.add("is-loaded"));
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(ready);
  setTimeout(ready, 1200);
})();
