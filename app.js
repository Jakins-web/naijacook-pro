import { db, ref, set, onValue, DEMO_MODE, authReady } from './firebase-config.js';

const $ = (id) => document.getElementById(id);
const BASE_SERVINGS = 2;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 8;

// ── Recipe model — mirrors the machine's 4 auger/shutter slots
// (rice, beans, yam, mixed-vegetables), the water/oil pumps, and
// the 8-pod spice revolver. Amounts below are per BASE_SERVINGS (2).
const RECIPES = {
  white_rice: {
    name: 'White Rice', img: 'white_rice.jpg', tagline: 'Simple, fluffy, no fuss',
    main: { slot: 'rice', label: 'Rice', grams: 300 },
    veg: null,
    oil_ml: 10, water_ratio: 2.0, time_min: 25,
    pods: { salt: 3 }
  },
  jollof_rice: {
    name: 'Jollof Rice', img: 'jollof_rice.jpg', tagline: 'A NaijaCook Pro classic',
    main: { slot: 'rice', label: 'Rice', grams: 300 },
    veg: { grams: 50, note: 'Onion + tatashe / bell pepper' },
    oil_ml: 20, water_ratio: 1.6, time_min: 35,
    pods: { salt: 3, curry: 4, thyme: 2, pepper: 4, maggi: 8 }
  },
  fried_rice: {
    name: 'Fried Rice', img: 'fried_rice.jpg', tagline: 'Colourful and fragrant',
    main: { slot: 'rice', label: 'Rice', grams: 300 },
    veg: { grams: 100, note: 'Onion + diced carrots, peas, green beans' },
    oil_ml: 25, water_ratio: 1.2, time_min: 30,
    pods: { salt: 3, curry: 4, thyme: 2, maggi: 6 }
  },
  beans_porridge: {
    name: 'Beans Porridge', img: 'beans_porridge.jpg', tagline: 'Hearty and filling',
    main: { slot: 'beans', label: 'Beans', grams: 300 },
    veg: { grams: 20, note: 'Onion only' },
    oil_ml: 25, water_ratio: 3.0, time_min: 50,
    pods: { salt: 3, pepper: 5, maggi: 6 }
  },
  yam_porridge: {
    name: 'Yam Porridge', img: 'yam_porridge.jpg', tagline: 'Asaro, done right',
    main: { slot: 'yam', label: 'Yam', grams: 300 },
    veg: { grams: 50, note: 'Onion + bell pepper / scotch bonnet' },
    oil_ml: 25, water_ratio: 1.2, time_min: 35,
    pods: { salt: 3, pepper: 6, maggi: 6 }
  },
  noodles: {
    name: 'Noodles', img: 'noodles.jpg', tagline: 'Quick Naija-style noodles',
    main: { slot: 'yam', label: 'Noodles', grams: 120 },
    veg: null,
    oil_ml: 10, water_ratio: 1.5, time_min: 12,
    pods: { salt: 1, noodle_seasoning: 10, cut_carrots: 30 },
    prep_note: 'Load noodles into the yam slot instead of yam for this dish — the machine reuses that slot\'s shutter-dump mechanism.'
  }
};

// Falls back to a plain initial-letter tile if an image fails to load,
// so a filename mismatch never shows a broken-image icon.
function imgOrFallback(key, cssClass) {
  const r = RECIPES[key];
  return `<img class="${cssClass}" src="${r.img}" alt="${r.name}" onerror="this.outerHTML='<span class=&quot;${cssClass} img-fallback&quot;>${r.name.charAt(0)}</span>'">`;
}

const POD_LABELS = {
  salt: 'Salt', curry: 'Curry powder', thyme: 'Thyme', pepper: 'Pepper',
  maggi: 'Maggi / seasoning cubes', noodle_seasoning: 'Noodle seasoning', cut_carrots: 'Cut carrots'
};

// ── State ──
let selectedFood = 'jollof_rice';
let servings = BASE_SERVINGS;
let lastTelemetryAt = 0;
let isCooking = false;
let activeTimeMin = null;
let remainingSeconds = null;
let demoTimer = null;

// ── Scaling ──
function scale(base) { return (base * servings) / BASE_SERVINGS; }
function scaleRound(base, min = 0) {
  const v = Math.round(scale(base));
  return base > 0 ? Math.max(min, v) : 0;
}

function computeBatch(foodKey, servingsCount) {
  const r = RECIPES[foodKey];
  const savedServings = servings;
  servings = servingsCount;
  const mainGrams = scaleRound(r.main.grams, 1);
  const vegGrams = r.veg ? scaleRound(r.veg.grams, 1) : 0;
  const oilMl = scaleRound(r.oil_ml, 1);
  const waterMl = Math.round(mainGrams * r.water_ratio);
  const pods = {};
  Object.entries(r.pods).forEach(([k, v]) => { pods[k] = scaleRound(v, 1); });
  servings = savedServings;
  return {
    food: foodKey, name: r.name, img: r.img, servings: servingsCount,
    main: { slot: r.main.slot, label: r.main.label, grams: mainGrams },
    veg: r.veg ? { grams: vegGrams, note: r.veg.note } : null,
    oil_ml: oilMl, water_ml: waterMl, pods, time_min: r.time_min,
    prep_note: r.prep_note || null
  };
}

// ── Navigation ──
function showPage(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === id));
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});
$('btnSelectFood').addEventListener('click', () => showPage('page-food'));
$('btnGotoSchedule').addEventListener('click', () => { renderScheduleSummary(); showPage('page-schedule'); });
$('btnBackHome').addEventListener('click', () => showPage('page-home'));
$('btnBackFood').addEventListener('click', () => showPage('page-home'));
$('btnBackRecipe').addEventListener('click', () => showPage('page-food'));
$('btnBackSchedule').addEventListener('click', () => showPage('page-home'));
$('btnEmptyGoFood').addEventListener('click', () => showPage('page-food'));
$('btnHeroCook').addEventListener('click', () => openRecipe(featuredFood));
$('btnGoScheduleFromRecipe').addEventListener('click', () => { renderScheduleSummary(); showPage('page-schedule'); });

$('navSettings').addEventListener('click', () => {
  $('modeLabel').textContent = DEMO_MODE ? 'Demo (no Firebase configured)' : 'Connected to Firebase';
  $('settingsModal').classList.remove('hidden');
});
$('closeSettings').addEventListener('click', () => $('settingsModal').classList.add('hidden'));

// ── Food grid ──
function renderFoodGrid() {
  const grid = $('foodGrid');
  grid.innerHTML = '';
  Object.entries(RECIPES).forEach(([key, r]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'food-card';
    btn.innerHTML = `
      ${imgOrFallback(key, 'food-emoji')}
      <span class="food-info">
        <span class="food-name">${r.name}</span>
        <span class="food-meta">${r.tagline} · ~${r.time_min} min</span>
      </span>
      <span class="food-chevron">›</span>`;
    btn.addEventListener('click', () => openRecipe(key));
    grid.appendChild(btn);
  });
}

// ── Recipe detail page ──
function openRecipe(key) {
  selectedFood = key;
  servings = BASE_SERVINGS;
  renderRecipePage();
  showPage('page-recipe');
}

function renderRecipePage() {
  const r = RECIPES[selectedFood];
  const batch = computeBatch(selectedFood, servings);

  $('recipeEmoji').innerHTML = imgOrFallback(selectedFood, 'recipe-emoji-img');
  $('recipeName').textContent = r.name;
  $('recipeTagline').textContent = r.tagline;
  $('servValue').textContent = servings;
  $('recipeTime').textContent = `${batch.time_min} min`;
  $('recipeWater').textContent = `${batch.water_ml} ml`;

  const banner = $('prepBanner');
  if (r.prep_note) {
    banner.textContent = r.prep_note;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  const list = $('ingredientList');
  list.innerHTML = '';

  list.appendChild(ingredientRow(batch.main.label, batch.main.slot + ' slot', `${batch.main.grams} g`, 'ing-main-row'));
  if (batch.veg) {
    list.appendChild(ingredientRow('Vegetable mix', batch.veg.note, `${batch.veg.grams} g`, 'ing-main-row'));
  }
  list.appendChild(ingredientRow('Oil', 'pumped from oil tank', `${batch.oil_ml} ml`, 'ing-pump'));
  list.appendChild(ingredientRow('Water', 'pumped from water tank', `${batch.water_ml} ml`, 'ing-pump'));
  Object.entries(batch.pods).forEach(([k, v]) => {
    if (v > 0) list.appendChild(ingredientRow(POD_LABELS[k] || k, 'spice pod', `${v} g`, 'ing-pod'));
  });
}

function ingredientRow(label, sub, amount, extraClass) {
  const row = document.createElement('div');
  row.className = `ing-row ${extraClass || ''}`;
  row.innerHTML = `
    <span class="ing-main"><strong>${label}</strong><span>${sub}</span></span>
    <span class="ing-amount">${amount}</span>`;
  return row;
}

$('servMinus').addEventListener('click', () => {
  if (servings > MIN_SERVINGS) { servings--; renderRecipePage(); }
});
$('servPlus').addEventListener('click', () => {
  if (servings < MAX_SERVINGS) { servings++; renderRecipePage(); }
  else toast('Maximum 8 servings per batch', 'err');
});

// ── Start confirmation sheet ──
$('btnGoStart').addEventListener('click', () => openStartSheet('start'));
$('sheetCancel').addEventListener('click', () => $('startSheet').classList.add('hidden'));

let pendingAction = null;
function openStartSheet(kind, scheduledFor) {
  const batch = computeBatch(selectedFood, servings);
  pendingAction = { kind, batch, scheduledFor };
  $('sheetTitle').textContent = kind === 'schedule' ? 'Confirm scheduled cook?' : 'Start cooking?';
  const podLines = Object.entries(batch.pods).filter(([, v]) => v > 0)
    .map(([k, v]) => `<div class="sr"><span>${POD_LABELS[k] || k}</span><span>${v} g</span></div>`).join('');
  $('sheetSummary').innerHTML = `
    <div class="sr"><span>Dish</span><span>${batch.name}</span></div>
    <div class="sr"><span>Servings</span><span>${batch.servings}</span></div>
    <div class="sr"><span>${batch.main.label}</span><span>${batch.main.grams} g (${batch.main.slot} slot)</span></div>
    ${batch.veg ? `<div class="sr"><span>Vegetable mix</span><span>${batch.veg.grams} g</span></div>` : ''}
    <div class="sr"><span>Oil</span><span>${batch.oil_ml} ml</span></div>
    <div class="sr"><span>Water</span><span>${batch.water_ml} ml</span></div>
    ${podLines}
    <div class="sr"><span>Est. time</span><span>${batch.time_min} min</span></div>
    ${scheduledFor ? `<div class="sr"><span>Starts at</span><span>${new Date(scheduledFor).toLocaleString()}</span></div>` : ''}
  `;
  $('startSheet').classList.remove('hidden');
}

$('sheetConfirm').addEventListener('click', async () => {
  const { kind, batch, scheduledFor } = pendingAction;
  const payload = {
    command: kind === 'schedule' ? 'SCHEDULE' : 'START',
    food: batch.food,
    servings: batch.servings,
    main: batch.main,
    veg: batch.veg,
    oil_ml: batch.oil_ml,
    water_ml: batch.water_ml,
    pods: batch.pods,
    est_time_min: batch.time_min,
    ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
    timestamp: Date.now()
  };
  try {
    if (!DEMO_MODE) {
      await authReady;
      await set(ref(db, 'appliance/control'), payload);
    } else {
      startDemoRun(batch);
    }
    toast(kind === 'schedule' ? 'Schedule sent' : 'Cooking started', 'ok');
    if (kind === 'schedule') {
      $('scheduledInfo').textContent = `${batch.name} will start at ${new Date(scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      showPage('page-schedule');
    } else {
      activeTimeMin = batch.time_min;
      $('cookFoodName').textContent = batch.name;
      showPage('page-cooking');
    }
  } catch (e) {
    toast('Could not reach the machine: ' + e.message, 'err');
  }
  $('startSheet').classList.add('hidden');
});

// ── Schedule page ──
function renderScheduleSummary() {
  const batch = computeBatch(selectedFood, servings);
  $('scheduleSummary').innerHTML = `
    <div class="ss-row"><span>Dish</span><span>${batch.name}</span></div>
    <div class="ss-row"><span>Servings</span><span>${batch.servings}</span></div>
    <div class="ss-row"><span>Est. time</span><span>${batch.time_min} min</span></div>`;
}
$('btnSchedule').addEventListener('click', () => {
  const timeVal = $('scheduleTime').value;
  if (!timeVal) { toast('Pick a time first', 'err'); return; }
  const [hh, mm] = timeVal.split(':').map(Number);
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  openStartSheet('schedule', target.getTime());
});

// ── Abort ──
$('btnAbortCook').addEventListener('click', async () => {
  try {
    if (!DEMO_MODE) {
      await authReady;
      await set(ref(db, 'appliance/control'), { command: 'STOP', timestamp: Date.now() });
    } else {
      stopDemoRun();
    }
    toast('Stop sent to machine', 'ok');
  } catch (e) {
    toast('Could not reach the machine: ' + e.message, 'err');
  }
});

// ── Toasts ──
function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  $('toastWrap').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Telemetry rendering (shared by Home + Cooking pages) ──
function applyTelemetry(data) {
  lastTelemetryAt = Date.now();

  const temp = data.temp != null ? `${data.temp}°C` : '--°C';
  const weight = data.weight != null ? `${Math.round(data.weight)}g` : '--g';
  const status = data.status || 'Idle';
  const pct = data.progress || 0;
  isCooking = !!data.is_cooking;

  $('homeTemp').textContent = temp;
  $('homeWeight').textContent = weight;
  $('homeStatus').textContent = status;
  $('cookTemp').textContent = temp;
  $('cookWeight').textContent = weight;
  $('progressFill').style.width = pct + '%';
  $('progressPct').textContent = pct + '%';
  $('cookStatus').textContent = 'Status: ' + status;

  $('cookEmptyState').classList.toggle('hidden', isCooking);
  $('progressSection').classList.toggle('hidden', !isCooking);
  $('btnAbortCook').classList.toggle('hidden', !isCooking);

  const totalMin = activeTimeMin ?? RECIPES[selectedFood].time_min;
  remainingSeconds = isCooking ? Math.max(0, Math.round(totalMin * 60 * (1 - pct / 100))) : null;
  const timeEl = $('cookTimeRemaining');
  if (isCooking && remainingSeconds != null) {
    timeEl.classList.remove('hidden');
    timeEl.textContent = formatRemaining(remainingSeconds);
  } else {
    timeEl.classList.add('hidden');
  }
}

function formatRemaining(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `⏱ ${m}:${String(s).padStart(2, '0')} remaining`;
}

function setConn(state) {
  $('connDot').className = 'dot' + (state === 'live' ? ' connected' : state === 'error' ? ' error' : '');
  $('connText').textContent = state === 'live' ? 'Connected' : state === 'error' ? 'Offline' : DEMO_MODE ? 'Demo mode' : 'Connecting';
}

// ── Live Firebase telemetry, or local demo simulation ──
if (!DEMO_MODE) {
  authReady.then(() => {
    setConn('live');   // auth + listener attached successfully -- this IS "connected",
                        // independent of whether the physical machine has ever reported
                        // telemetry yet (that's a separate "is the machine on" question)
    onValue(ref(db, 'appliance/telemetry'), (snap) => {
      const data = snap.val();
      if (data) applyTelemetry(data);
    }, () => setConn('error'));
  }).catch((err) => {
    console.error('Auth failed, telemetry not connected:', err);
    setConn('error');
    toast('Could not sign in to Firebase — check Anonymous auth is enabled', 'err');
  });
} else {
  setConn('demo');
  applyTelemetry({ temp: null, weight: 0, status: 'Idle', progress: 0, is_cooking: false });
}

function startDemoRun(batch) {
  stopDemoRun();
  let pct = 0;
  const start = Date.now();
  demoTimer = setInterval(() => {
    pct = Math.min(100, pct + 2);
    applyTelemetry({
      temp: Math.min(98, 25 + pct * 0.7).toFixed(1),
      weight: Math.round(batch.main.grams * (pct / 100)),
      status: pct < 100 ? 'Cooking' : 'COOKING COMPLETE!',
      progress: pct,
      is_cooking: pct < 100
    });
    if (pct >= 100) stopDemoRun();
  }, 700);
}
function stopDemoRun() {
  if (demoTimer) clearInterval(demoTimer);
  demoTimer = null;
  applyTelemetry({ temp: 25, weight: 0, status: 'Idle', progress: 0, is_cooking: false });
}

setInterval(() => {
  if (isCooking && remainingSeconds != null && remainingSeconds > 0) {
    remainingSeconds--;
    $('cookTimeRemaining').textContent = formatRemaining(remainingSeconds);
  }
}, 1000);

// Detect a machine that stopped sending updates.
setInterval(() => {
  if (!DEMO_MODE && lastTelemetryAt && Date.now() - lastTelemetryAt > 15000) setConn('error');
}, 5000);

// ── Home hero + notifications ──
let featuredFood = 'jollof_rice';
function renderHero() {
  const r = RECIPES[featuredFood];
  $('heroImgWrap').innerHTML = imgOrFallback(featuredFood, 'hero-img');
  $('heroName').textContent = r.name;
  $('heroMeta').textContent = `Serves ${BASE_SERVINGS} · ~${r.time_min} min`;
  $('btnHeroCook').textContent = `Cook ${r.name.toLowerCase()} →`;
}

function renderNotifications() {
  const list = $('notifList');
  list.innerHTML = '';
  if (DEMO_MODE) {
    const el = document.createElement('div');
    el.className = 'notif-item warn';
    el.textContent = "Running in demo mode — add your Firebase project details in firebase-config.js to connect to the real machine.";
    list.appendChild(el);
  } else {
    const el = document.createElement('div');
    el.className = 'notif-empty';
    el.textContent = 'No notifications yet.';
    list.appendChild(el);
  }
}

// ── Init ──
renderFoodGrid();
renderHero();
renderNotifications();
renderRecipePage();
