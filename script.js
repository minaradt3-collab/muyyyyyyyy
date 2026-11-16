(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const k = reduce ? 0.3 : 1;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * k));

  const scene1 = $("#scene1");
  const scene2 = $("#scene2");
  const scene3 = $("#scene3");
  const heartSvg = $("#heartSvg");
  const guide = $("#guide");
  const prompt = $("#prompt");
  const promptSmall = $("#promptSmall");
  const resetBtn = $("#reset");
  const envelope = $("#envelope");
  const letter = $("#letter");
  const seal = $("#seal");
  const glow = $("#glow");
  const hint = $("#hint");

  /* ---------- songs ---------- */
  const song1 = $("#song1");
  const song2 = $("#song2");
  function fadeTo(audio, target, ms, then) {
    const start = audio.volume;
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min((now - t0) / ms, 1);
      audio.volume = start + (target - start) * t;
      if (t < 1) requestAnimationFrame(step);
      else if (then) then();
    })(t0);
  }
  function playSong(audio) {
    audio.volume = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {}); // no file / blocked: stay silent
    fadeTo(audio, 1, 1500);
  }
  let song1Started = false;

  /* ---------- floating hearts in the background ---------- */
  const floaters = $("#floaters");
  function spawnHeart() {
    if (reduce || document.hidden) return;
    const h = document.createElement("span");
    h.textContent = "\u2665";
    h.style.left = Math.random() * 100 + "vw";
    h.style.fontSize = 10 + Math.random() * 18 + "px";
    h.style.setProperty("--drift", Math.random() * 80 - 40 + "px");
    h.style.setProperty("--rot", Math.random() * 60 - 30 + "deg");
    const dur = 7 + Math.random() * 6;
    h.style.animationDuration = dur + "s";
    floaters.appendChild(h);
    setTimeout(() => h.remove(), dur * 1000);
  }
  let floatTimer = null;
  const startFloaters = () => { if (!floatTimer) floatTimer = setInterval(spawnHeart, 900); };
  const stopFloaters = () => { clearInterval(floatTimer); floatTimer = null; };

  /* ---------- page 1: draw the heart ---------- */
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  let drawing = false, done = false;
  let prev = null, prevMid = null, idleTimer = null;
  let length = 0, minX, minY, maxX, maxY;

  function resetInk() {
    length = 0;
    minX = minY = Infinity;
    maxX = maxY = -Infinity;
  }

  function styleCtx() {
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ff9bb3";
    ctx.fillStyle = "#ff9bb3";
    ctx.shadowColor = "rgba(255, 77, 121, 0.9)";
    ctx.shadowBlur = 14;
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    styleCtx();
    resetInk();
  }
  sizeCanvas();

  window.addEventListener("resize", () => {
    if (done || drawing) return;
    // ignore small changes (mobile address bar); redo canvas on real resizes
    if (Math.abs(canvas.clientWidth - W) > 80 || Math.abs(canvas.clientHeight - H) > 120) sizeCanvas();
  });

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function track(p) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (done) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    clearTimeout(idleTimer);
    if (!song1Started) { song1Started = true; playSong(song1); } // 1st song: first touch on the drawing
    const p = pos(e);
    prev = p;
    prevMid = p;
    track(p);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    prompt.classList.add("gone");
    resetBtn.classList.add("visible");
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || done) return;
    const p = pos(e);
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    const mid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
    ctx.stroke();
    prev = p;
    prevMid = mid;
    track(p);
  });

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(evaluate, 900);
  }
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  resetBtn.addEventListener("click", () => {
    if (done) return;
    clearTimeout(idleTimer);
    ctx.clearRect(0, 0, W, H);
    resetInk();
    resetBtn.classList.remove("visible");
    promptSmall.textContent = "Trace the dotted line with your finger";
    prompt.classList.remove("gone");
  });

  // lenient check: a big enough, roughly heart-sized, closed-ish shape
  function evaluate() {
    if (done || drawing || !isFinite(minX)) return;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const size = Math.max(bw, bh);
    const minSize = Math.min(W, H) * 0.22;
    const ratio = bh > 0 ? bw / bh : 0;
    const ok = size >= minSize && length >= size * 2.4 && ratio > 0.55 && ratio < 1.8;
    if (ok) {
      complete(bw, bh);
    } else {
      promptSmall.textContent = "Keep going \u2014 draw the whole heart";
      prompt.classList.remove("gone");
    }
  }

  async function complete(bw, bh) {
    done = true;
    resetBtn.classList.remove("visible");
    guide.classList.add("gone");
    prompt.classList.add("gone");

    // place a clean heart right where the user drew
    let w = Math.max(bw, (bh * 200) / 180) * 1.08;
    w = Math.min(Math.max(w, 200), Math.min(W * 0.94, 520));
    const h = w * 0.9;
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;
    cx = Math.min(Math.max(cx, w / 2 + 8), W - w / 2 - 8);
    cy = Math.min(Math.max(cy, h / 2 + 8), H - h / 2 - 8);
    heartSvg.style.width = w + "px";
    heartSvg.style.left = cx - w / 2 + "px";
    heartSvg.style.top = cy - h / 2 + "px";

    startFloaters();
    heartSvg.classList.add("draw");   // clean outline traces over the drawing
    canvas.classList.add("fade");     // the hand-drawn line melts away
    await sleep(1500);

    heartSvg.classList.add("filled"); // fills and starts beating
    await sleep(1700);

    heartSvg.classList.add("write");  // SODO is written inside
    await sleep(4500);

    scene1.classList.remove("active");
    await sleep(1000);
    scene2.classList.add("active");
  }

  /* ---------- page 2: open the letter ---------- */
  function burst() {
    const r = seal.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 14; i++) {
      const el = document.createElement("span");
      el.className = "burst";
      el.textContent = "\u2665";
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 110;
      el.style.left = cx + "px";
      el.style.top = cy + "px";
      el.style.fontSize = 12 + Math.random() * 14 + "px";
      el.style.setProperty("--dx", Math.cos(a) * d + "px");
      el.style.setProperty("--dy", Math.sin(a) * d - 40 + "px");
      el.style.setProperty("--r", Math.random() * 120 - 60 + "deg");
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  let opened = false;
  async function openLetter() {
    if (opened) return;
    opened = true;
    envelope.disabled = true;
    hint.classList.add("gone");

    // 2nd song: tapping the envelope
    fadeTo(song1, 0, 1500, () => song1.pause());
    playSong(song2);

    // 1) the seal cracks and bursts into little hearts
    envelope.classList.add("cracked");
    burst();
    await sleep(550);

    // 2) the flap opens, a warm light fades in
    envelope.classList.add("open");
    glow.classList.add("on");
    await sleep(1100);

    // 3) the letter slides out of the envelope
    envelope.classList.add("rise");
    await sleep(1500);

    // 4) the envelope falls away, the letter floats to the centre and grows
    const er = envelope.getBoundingClientRect();
    const letterW = er.width * 0.84;
    const cx = er.left + er.width / 2;
    const cy = er.top + er.height * 0.47;
    const s = Math.min(window.innerWidth * 0.9, 560) / letterW;
    letter.style.zIndex = "6";
    envelope.classList.add("drop");
    letter.style.transition = "transform 1.5s cubic-bezier(.3,.7,.2,1)";
    letter.style.transform =
      "translate(" + (window.innerWidth / 2 - cx) + "px," + (window.innerHeight / 2 - cy) + "px) scale(" + s + ")";
    await sleep(1700);

    // 5) the letter fades into the full page and unfolds
    scene2.classList.remove("active");
    await sleep(900);
    stopFloaters();
    scene3.classList.add("active");
    revealParagraphs();
  }
  envelope.addEventListener("click", openLetter);

  /* ---------- page 3: the message ---------- */
  function revealParagraphs() {
    const items = [...document.querySelectorAll("#message p, .sign")];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("show");
            io.unobserve(e.target);
          }
        });
      },
      { root: scene3, threshold: 0.2 }
    );
    items.forEach((el) => io.observe(el));
  }

  $("#again").addEventListener("click", () => location.reload());
})();
