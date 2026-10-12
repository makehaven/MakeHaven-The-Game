/* Shared GDevelop scene event. Source of truth: this file + levels.json.
 * Native sprites/text render the game. A fixed-step, one-way-platform physics
 * loop makes short workshop routes forgiving and independent of frame rate.
 */
if (!runtimeScene._maker) {
  const W = 1280, H = 720, FLOOR = 642, SPEED = 300, GRAVITY = 1500, JUMP = 700;
  const game = runtimeScene.getGame();
  const session = game._makerSession || (game._makerSession = {
    badges: [], previous: {}, lastActivity: Date.now(), inputMode: 'keyboard', selected: 0,
    muted: true, audio: null,
  });
  const sceneName = runtimeScene.getName();
  const levelIndex = MAKER_LEVELS.findIndex(l => l.scene === sceneName);
  const level = MAKER_LEVELS[levelIndex];
  const state = {
    mode: level ? 'explore' : sceneName === 'Shop Map' ? 'map' : 'title',
    player: { x: 65, y: FLOOR - 72, vx: 0, vy: 0, w: 64, h: 72, grounded: true, coyote: .1, buffer: 0, facing: 1 },
    collected: [], objects: new Map(), used: new Set(), clock: 0, accumulator: 0,
    paused: false, connected: false, disconnected: false, input: {}, edge: {},
    selected: session.selected, step: 0, choice: 0, rotations: [1, 3, 2],
    offset: { x: -45, y: 30 }, focus: 15, feedback: '', feedbackUntil: 0,
    completedAt: 0, previousTime: Date.now(), repeatAt: 0,
    enemies: [
      {x: 505, y: 570, vx: 72, kind: 'FireVac', dead: false},
      {x: 820, y: 570, vx: -58, kind: 'Fly', dead: false},
      {x: 1010, y: 358, vx: 48, kind: 'FireVac', dead: false},
    ],
    ladder: {x: 575, y: 278, w: 54, h: 365},
    movingEnabled: true,
  };
  // Every scene inherits the same held-button state: holding A through a
  // transition cannot accidentally start another activity or skip a result.
  session.lastActivity = Date.now();

  const C = { ink: '14;29;39', dark: '9;21;31', panel: '23;43;54', cream: '247;239;219',
    muted: '166;188;190', gold: '250;199;95', coral: '238;116;91', teal: '94;206;186', white: '255;255;255' };
  let z = 0;
  function object(key, type) {
    state.used.add(key);
    if (!state.objects.has(key)) state.objects.set(key, runtimeScene.createObject(type));
    const o = state.objects.get(key);
    o.hide(false); o.setZOrder(z++);
    return o;
  }
  function rect(key, x, y, w, h, color = C.panel, opacity = 255, angle = 0) {
    const o = object(key, 'MakerPanel');
    o.setPosition(x, y); o.setWidth(w); o.setHeight(h); o.setColor(color); o.setOpacity(opacity); o.setAngle(angle);
    return o;
  }
  function orb(key, x, y, size, color, opacity = 255) {
    const o = object(key, 'MakerOrb');
    o.setPosition(x, y); o.setWidth(size); o.setHeight(size); o.setColor(color); o.setOpacity(opacity);
    return o;
  }
  function label(key, text, x, y, size = 24, color = C.cream) {
    const o = object(key, 'MakerText');
    o.setPosition(x, y); o.setString(text); o.setCharacterSize(size); o.setColor(color);
    return o;
  }
  function art(key, type, x, y, w, h, opacity = 255) {
    const o = object(key, type);
    o.setPosition(x, y); o.setWidth(w); o.setHeight(h); o.setOpacity(opacity);
    return o;
  }
  function legacy(key, type, x, y, w, h, angle = 0, opacity = 255) {
    const o = art(key, type, x, y, w, h, opacity);
    o.setAngle(angle);
    return o;
  }
  function button(key, text, x, y, w, selected = false, color = C.gold) {
    rect(key + '-border', x - 3, y - 3, w + 6, 54, selected ? color : C.panel);
    rect(key + '-fill', x, y, w, 48, selected ? color : C.panel);
    label(key + '-text', text, x + 17, y + 10, 23, selected ? C.ink : C.cream);
  }
  function feedback(message) { state.feedback = message; state.feedbackUntil = state.clock + 2.5; }
  function go(name) { gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, name, false); }
  function home() {
    session.badges = []; session.selected = 0; session.muted = true;
    session.lastActivity = Date.now(); go('Title Screen');
  }
  function sound(high = false) {
    if (session.muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      session.audio = session.audio || new Audio();
      if (session.audio.state === 'suspended') session.audio.resume().catch(() => {});
      const osc = session.audio.createOscillator(), gain = session.audio.createGain();
      osc.type = 'sine'; osc.frequency.value = high ? 660 : 440;
      gain.gain.setValueAtTime(.045, session.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, session.audio.currentTime + .15);
      osc.connect(gain); gain.connect(session.audio.destination); osc.start(); osc.stop(session.audio.currentTime + .16);
    } catch (_) { /* Sound is optional; controls never depend on audio. */ }
  }
  function poll() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    const pad = pads.find(p => p && p.connected);
    const key = name => gdjs.evtTools.input.isKeyPressed(runtimeScene, name);
    const held = n => !!pad?.buttons[n]?.pressed;
    const axisX = pad?.axes[0] || 0, axisY = pad?.axes[1] || 0;
    const keyboard = {
      left: key('Left') || key('a'), right: key('Right') || key('d'),
      up: key('Up') || key('w'), down: key('Down') || key('s'),
      a: key('Space') || key('Return'), x: key('e'), b: key('Escape'),
      y: key('r'), start: key('p'), mute: key('m'),
    };
    const input = {
      left: held(14) || axisX < -.4, right: held(15) || axisX > .4,
      up: held(12) || axisY < -.4, down: held(13) || axisY > .4,
      a: held(0), b: held(1), x: held(2), y: held(3), start: held(9), mute: held(8),
    };
    if (Object.values(input).some(Boolean)) session.inputMode = 'gamepad';
    if (Object.values(keyboard).some(Boolean)) session.inputMode = 'keyboard';
    for (const k in input) input[k] ||= keyboard[k];
    state.edge = {};
    for (const k in input) {
      state.edge[k] = input[k] && !session.previous[k];
      if (input[k] !== !!session.previous[k]) session.lastActivity = Date.now();
    }
    session.previous = { ...input }; state.input = input;
    state.connected = !!pad;
    state.disconnected = session.inputMode === 'gamepad' && !pad;
  }
  function nav() {
    const i = state.input, e = state.edge;
    const dx = Number(i.right) - Number(i.left), dy = Number(i.down) - Number(i.up);
    if (!dx && !dy) { state.repeatAt = 0; return { x: 0, y: 0 }; }
    if (e.left || e.right || e.up || e.down) {
      state.repeatAt = state.clock + .32; return { x: dx, y: dy };
    }
    if (state.clock >= state.repeatAt) { state.repeatAt = state.clock + .15; return { x: dx, y: dy }; }
    return { x: 0, y: 0 };
  }
  function complete() {
    if (!session.badges.includes(level.id)) session.badges.push(level.id);
    state.mode = 'complete'; state.completedAt = state.clock; sound(true);
  }
  function nextStep() {
    state.step++; sound(true);
    if (state.step >= (level.challenge === 'pattern' ? 4 : 3)) complete();
    else feedback('Nice! Keep making.');
  }
  function physics(dt) {
    const p = state.player;
    p.coyote = Math.max(0, p.coyote - dt); p.buffer = Math.max(0, p.buffer - dt);
    if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.buffer = 0; p.coyote = 0; p.grounded = false; }
    p.vx = (Number(state.input.right) - Number(state.input.left)) * SPEED;
    if (p.vx) p.facing = Math.sign(p.vx);
    p.x = Math.max(12, Math.min(W - p.w - 12, p.x + p.vx * dt));
    // A ladder is a safe route between the upper benches. Hold up/down while
    // overlapping it to climb, just as in the original platformer.
    const ladder = state.ladder;
    const onLadder = p.x + p.w > ladder.x && p.x < ladder.x + ladder.w && p.y + p.h > ladder.y && p.y < ladder.y + ladder.h;
    if (onLadder && (state.input.up || state.input.down)) {
      p.vy = (Number(state.input.down) - Number(state.input.up)) * 190;
      p.y = Math.max(ladder.y - p.h, Math.min(FLOOR - p.h, p.y + p.vy * dt));
      p.grounded = false; p.coyote = .1;
    }
    const bottom = p.y + p.h;
    p.vy += GRAVITY * dt; p.y += p.vy * dt; p.grounded = false;
    const movingX = 520 + Math.sin(state.clock * 1.25) * 170;
    const surfaces = state.movingEnabled ? [[0, FLOOR, W], ...level.platforms, [movingX, 205, 170]] : [[0, FLOOR, W], ...level.platforms];
    for (const [x, y, w] of surfaces) {
      if (p.vy >= 0 && bottom <= y + 1 && p.y + p.h >= y && p.x + p.w - 10 > x && p.x + 10 < x + w) {
        p.y = y - p.h; p.vy = 0; p.grounded = true; p.coyote = .10;
      }
    }
    if (p.y > H + 150) { p.x = 65; p.y = FLOOR - p.h; p.vy = 0; }
    level.platforms.forEach(([x, y, w], n) => {
      const cx = x + w / 2, cy = y - 37;
      if (!state.collected.includes(n) && p.x < cx + 21 && p.x + p.w > cx - 21 && p.y < cy + 24 && p.y + p.h > cy - 24) {
        state.collected.push(n); sound();
        if (state.collected.length === level.platforms.length) feedback('All materials found! Visit the making bench on the right.');
      }
    });
    // The old roaming tool enemies are dangerous from the side, but fair to
    // defeat: land on one while falling to bounce and remove it.
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < 350 || enemy.x > 1100) enemy.vx *= -1;
      const hit = p.x + p.w > enemy.x && p.x < enemy.x + 62 && p.y + p.h > enemy.y && p.y < enemy.y + 62;
      if (hit) {
        if (p.vy > 0 && p.y + p.h < enemy.y + 30) {
          enemy.dead = true; p.vy = -JUMP * .72; p.grounded = false; sound(true); feedback('Tool enemy defeated!');
        } else {
          p.x = 65; p.y = FLOOR - p.h; p.vy = 0; state.collected = state.collected.slice(); feedback('Ouch! The tools are hazardous. Try jumping on them.');
        }
      }
    }
  }
  function benchUpdate(dt, move) {
    const e = state.edge, challenge = level.challenge;
    if (challenge === 'assemble' || challenge === 'pattern') {
      state.choice = (state.choice + move.x + 3) % 3;
      if (e.a || e.x) {
        if (state.choice === level.order[state.step]) nextStep();
        else feedback('Try the highlighted target. There is no penalty.');
      }
    } else if (challenge === 'timing') {
      if (e.a || e.x) {
        const cursor = (Math.sin(state.clock * 1.8) + 1) / 2;
        if (cursor >= .32 && cursor <= .68) nextStep();
        else feedback('Almost! Press when the marker enters the gold zone.');
      }
    } else if (challenge === 'circuit') {
      state.choice = (state.choice + move.x + 3) % 3;
      if (e.a || e.x) {
        state.rotations[state.choice] = (state.rotations[state.choice] + 1) % 4;
        sound();
        if (state.rotations.every(n => n % 2 === 0)) complete();
      }
    } else if (challenge === 'register') {
      state.offset.x = Math.max(-90, Math.min(90, state.offset.x + (Number(state.input.right) - Number(state.input.left)) * 70 * dt));
      state.offset.y = Math.max(-65, Math.min(65, state.offset.y + (Number(state.input.down) - Number(state.input.up)) * 70 * dt));
      if (e.a || e.x) {
        if (Math.abs(state.offset.x) <= 10 && Math.abs(state.offset.y) <= 10) {
          nextStep(); state.offset = { x: state.step % 2 ? 45 : -40, y: -30 };
        } else feedback('Move the colored frame onto the cream target, then press A.');
      }
    } else if (challenge === 'focus') {
      state.focus = Math.max(0, Math.min(100, state.focus + (Number(state.input.up) - Number(state.input.down)) * 35 * dt));
      if (e.a || e.x) {
        const target = [45, 70, 30][state.step];
        if (Math.abs(state.focus - target) <= 9) { nextStep(); state.focus = 15; }
        else feedback('Use up / down until the sample is sharp and the gauge is gold.');
      }
    }
  }
  function header(kicker, title, subtitle, color = C.gold) {
    label('kicker', kicker, 48, 28, 18, color);
    label('heading', title, 48, 54, 46);
    if (subtitle) label('subtitle', subtitle, 50, 112, 23, C.muted);
  }
  function footer(text) {
    rect('footer-bg', 0, 672, W, 48, C.dark);
    label('footer', text, 40, 685, 19, C.cream);
    label('audio-label', session.muted ? 'SOUND OFF' : 'SOUND ON', 1110, 688, 15, C.muted);
  }
  function drawTitle() {
    rect('base', 0, 0, W, H, C.dark);
    art('title-art', 'MakerTitleArt', 610, 129, 670, 447, 240);
    label('title-right-kicker', 'PLAY. EXPLORE. CREATE.', 725, 73, 25, C.gold);
    label('title-right-caption', 'Your next adventure is right here.', 738, 615, 23, C.muted);
    rect('title-shade', 0, 0, 610, H, C.ink, 245);
    label('title-eyebrow', 'WELCOME TO THE MAKERSPACE', 55, 67, 20, C.gold);
    label('title-name', 'MAKEHAVEN', 50, 125, 66);
    label('title-name2', 'Make something.', 55, 206, 42, C.gold);
    label('title-copy', 'Six shops. Six small adventures.\nA whole world of things you can make.', 55, 283, 25, C.cream);
    button('start', 'A / CROSS    Explore the shops', 55, 395, 480, true);
    label('title-controls', 'Move: stick or D-pad    Jump: A / Cross\nMake: X / Square    Shop map: B / Circle', 55, 474, 22, C.muted);
    const preview = MAKER_LEVELS[Math.floor(state.clock / 4) % MAKER_LEVELS.length];
    label('title-preview', 'DISCOVER  /  ' + preview.title.toUpperCase(), 55, 578, 20, preview.color);
    label('title-preview-tag', preview.tag, 55, 610, 24);
    footer(state.connected ? 'Controller connected  •  Press A / Cross or START to begin' : 'Press a gamepad button to connect  •  Keyboard: ENTER to begin');
  }
  function projectArt(prefix, id, cx, cy, scale = 1, progress = 3) {
    const box = (n, x, y, w, h, color, angle = 0) => rect(prefix+n, cx+x*scale, cy+y*scale, w*scale, h*scale, color, 255, angle);
    const dot = (n, x, y, size, color, opacity = 255) => orb(prefix+n, cx+x*scale, cy+y*scale, size*scale, color, opacity);
    if (id === 'woodshop') {
      box('base', -75, 70, 150, 16, C.gold);
      if (progress >= 2) box('walls', -60, -25, 120, 95, '195;132;70');
      if (progress >= 2) { dot('hole', -24, -7, 48, C.ink); box('perch', -30, 47, 60, 8, C.cream); }
      if (progress >= 3) { box('roof1', -82, -48, 96, 16, C.coral, -35); box('roof2', -4, -48, 96, 16, C.coral, 35); }
    } else if (id === 'textiles') {
      box('cloth', -95, -85, 190, 170, C.cream);
      for (let i=0;i<9;i++) box('patch'+i, -83+(i%3)*57, -73+Math.floor(i/3)*50, 50, 43, [C.teal,C.coral,C.gold][i%3]);
      for (let i=0;i<8;i++) { box('stitch'+i, -85+i*23, 75, 10, 3, C.ink); }
    } else if (id === 'metalshop') {
      box('base', -70, 80, 140, 15, C.muted); box('stem', -8, -35, 16, 120, C.teal);
      for (let i=0;i<5;i++) { const a=i*Math.PI*2/5; dot('petal'+i, Math.cos(a)*48-25, Math.sin(a)*48-65, 50, C.coral); }
      dot('center', -25, -65, 50, C.gold);
    } else if (id === 'electronics') {
      box('pcb', -105, -75, 210, 155, '47;112;91');
      box('wire1', -80, 25, 145, 8, C.gold); box('wire2', 55, -30, 8, 60, C.gold);
      box('battery', -80, -45, 46, 60, C.cream); dot('led-glow', 14, -75, 96, C.gold, 65); dot('led', 37, -52, 50, C.gold);
    } else if (id === 'printmaking') {
      box('paper', -100, -95, 200, 200, C.cream); dot('sun', -65, -65, 105, C.gold);
      box('block', -55, -5, 115, 85, C.coral); dot('circle', 0, 0, 65, C.teal);
      box('line', -80, 87, 160, 4, C.ink);
    } else {
      dot('scope', -100, -100, 200, C.cream); dot('field', -87, -87, 174, '39;91;79');
      for (let i=0;i<5;i++) { dot('cell'+i, -60+(i%3)*42, -50+Math.floor(i/3)*58, 35, C.teal); dot('nucleus'+i, -49+(i%3)*42, -39+Math.floor(i/3)*58, 10, C.gold); }
    }
  }
  function drawMap() {
    rect('base', 0, 0, W, H, C.dark);
    header('YOUR MAKEHAVEN ADVENTURE', 'What will you make today?', 'Choose any shop. Each visit is a short adventure.');
    label('badge-count', session.badges.length + ' / 6 made', 1080, 55, 22, C.gold);
    MAKER_LEVELS.forEach((l, n) => {
      const x = 48 + n % 3 * 401, y = 173 + Math.floor(n/3)*231;
      rect('card-border'+n, x-4, y-4, 381, 215, n===state.selected ? l.color : C.panel);
      art('card-art'+n, 'MakerBackdrop_'+l.id, x, y, 373, 207, n===state.selected ? 255 : 165);
      rect('card-shade'+n, x, y+120, 373, 87, C.ink, 240);
      label('card-num'+n, '0'+(n+1), x+16, y+14, 22, C.cream);
      label('card-title'+n, l.title, x+16, y+130, 30, n===state.selected ? l.color : C.cream);
      label('card-project'+n, l.project, x+16, y+170, 19);
      if (session.badges.includes(l.id)) { rect('badge-bg'+n, x+235, y+12, 122, 34, l.color); label('badge'+n, 'MADE IT!', x+245, y+17, 18, C.ink); }
    });
    footer('Stick / D-pad  Choose     A / Cross  Enter shop     B / Circle  Welcome     SELECT  Sound');
  }
  // Small code-native foreground art keeps the shop identity readable even
  // when a room uses shared machines. These motifs intentionally cross over
  // between shops: every room still feels like one MakeHaven building.
  function drawThemeProps() {
    const id = level.id, c = level.color;
    if (id === 'woodshop') {
      rect('prop-wood-table', 210, 585, 220, 16, '180;113;52');
      for (let n=0;n<4;n++) rect('prop-clamp'+n, 235+n*48, 550, 9, 36, C.muted);
      rect('prop-wood-rack', 452, 397, 10, 185, c); rect('prop-wood-rack2', 622, 397, 10, 185, c);
      for (let n=0;n<4;n++) rect('prop-lumber'+n, 462, 415+n*37, 160, 13, '195;132;70');
    } else if (id === 'textiles') {
      rect('prop-textile-table', 210, 585, 230, 16, c);
      for (let n=0;n<5;n++) { rect('prop-spool'+n, 240+n*38, 538, 20, 45, [C.coral,C.gold,C.teal][n%3]); orb('prop-thread'+n, 238+n*38, 527, 24, C.cream); }
      rect('prop-quilt', 460, 370, 175, 105, C.cream);
      for(let n=0;n<9;n++) rect('prop-quilt'+n, 470+(n%3)*53, 380+Math.floor(n/3)*30, 48, 25, [C.coral,C.gold,C.teal][n%3]);
    } else if (id === 'metalshop') {
      rect('prop-metal-table', 205, 585, 230, 16, '108;127;145');
      rect('prop-vise', 295, 531, 54, 54, C.muted); rect('prop-vise-jaw', 277, 523, 90, 12, c);
      for(let n=0;n<5;n++) rect('prop-metal-bar'+n, 460+n*28, 414, 18, 170, '108;127;145');
      rect('prop-weld-glow', 656, 530, 56, 56, c, 75); orb('prop-weld', 665, 539, 38, C.gold);
    } else if (id === 'electronics') {
      rect('prop-electro-table', 190, 585, 260, 16, '47;112;91');
      for(let n=0;n<6;n++) { rect('prop-drawer'+n, 225+(n%3)*67, 487+Math.floor(n/3)*42, 52, 31, C.panel); orb('prop-led'+n, 235+(n%3)*67, 496+Math.floor(n/3)*42, 9, [C.coral,C.gold,C.teal][n%3]); }
      rect('prop-scope', 500, 450, 130, 80, C.panel); rect('prop-scope-line', 514, 487, 102, 4, c); rect('prop-scope-line2', 560, 465, 4, 45, c);
    } else if (id === 'printmaking') {
      rect('prop-print-table', 190, 585, 250, 16, '117;77;100');
      rect('prop-press', 280, 460, 120, 125, C.panel); rect('prop-press-bed', 247, 520, 185, 15, c); rect('prop-roller', 260, 500, 160, 17, C.coral);
      for(let n=0;n<4;n++) { rect('prop-print'+n, 470+n*45, 424, 33, 115, C.cream); rect('prop-print-ink'+n, 477+n*45, 440, 19, 46, [C.coral,C.teal,C.gold][n%3]); }
    } else {
      rect('prop-bio-table', 190, 585, 260, 16, '39;91;79');
      for(let n=0;n<4;n++) { rect('prop-vial'+n, 230+n*43, 503, 25, 72, C.cream); rect('prop-vial-liquid'+n, 235+n*43, 532, 15, 38, [C.teal,C.gold,c][n%3]); }
      rect('prop-bio-microscope', 520, 459, 22, 126, C.muted); rect('prop-bio-lens', 493, 447, 80, 18, C.muted); orb('prop-bio-dish', 560, 526, 62, C.cream); orb('prop-bio-dish-inner', 570, 536, 42, '39;91;79');
    }
    // Shared safety placard and tool rack appear in every shop.
    rect('shared-safety', 730, 390, 145, 75, C.ink, 230); label('shared-safety-text', 'MAKE\nSAFELY', 758, 400, 21, c);
    for(let n=0;n<4;n++) rect('shared-rack'+n, 760+n*25, 480, 7, 74, C.muted);
  }
  function drawThemeEnemy(enemy, n) {
    const x=enemy.x, y=enemy.y, c=level.color, id=level.id;
    // Each hazard is a friendly caricature of a tool or material from its shop.
    if(id==='woodshop') {
      rect('enemy-body'+n,x,y+13,62,40,'180;113;52'); rect('enemy-blade'+n,x+8,y+4,46,12,C.muted);
      orb('enemy-eye1'+n,x+16,y+26,12,C.cream); orb('enemy-eye2'+n,x+39,y+26,12,C.cream);
    } else if(id==='textiles') {
      orb('enemy-body'+n,x,y,62,c); rect('enemy-thread'+n,x+10,y+25,42,7,C.coral); orb('enemy-eye1'+n,x+15,y+15,12,C.ink); orb('enemy-eye2'+n,x+37,y+15,12,C.ink);
    } else if(id==='metalshop') {
      rect('enemy-body'+n,x,y+15,62,40,'108;127;145'); rect('enemy-jaw'+n,x+8,y,46,13,c); orb('enemy-eye1'+n,x+15,y+28,12,C.gold); orb('enemy-eye2'+n,x+37,y+28,12,C.gold);
    } else if(id==='electronics') {
      rect('enemy-body'+n,x,y+10,62,48,'47;112;91'); for(let k=0;k<3;k++) rect('enemy-trace'+n+'-'+k,x+10+k*17,y+20,5,29,c); orb('enemy-led'+n,x+24,y+28,14,C.gold);
    } else if(id==='printmaking') {
      rect('enemy-body'+n,x,y+15,62,43,'117;77;100'); rect('enemy-roller'+n,x+7,y+2,48,14,C.coral); orb('enemy-eye1'+n,x+17,y+29,12,C.cream); orb('enemy-eye2'+n,x+39,y+29,12,C.cream);
    } else {
      orb('enemy-body'+n,x,y,62,'39;91;79'); orb('enemy-dish'+n,x+13,y+13,36,c); orb('enemy-eye1'+n,x+20,y+22,9,C.ink); orb('enemy-eye2'+n,x+36,y+22,9,C.ink);
    }
    label('enemy-mark'+n, '!', x+25, y+1, 23, C.coral);
  }
  function drawExplore() {
    art('backdrop', 'MakerBackdrop_'+level.id, 0, 0, W, H, 190);
    const movingX = 520 + Math.sin(state.clock * 1.25) * 170;
    rect('backdrop-tint', 0, 0, W, H, C.ink, 35);
    rect('hud-bg', 0, 0, W, 129, C.ink, 245);
    label('shop-kicker', '0'+(levelIndex+1)+'  /  MAKEHAVEN', 35, 20, 17, level.color);
    label('shop-title', level.title, 32, 45, 37);
    label('shop-objective', 'Gather '+level.platforms.length+' '+level.material+' to make '+level.project+'.', 35, 94, 21);
    label('counter', state.collected.length+' / '+level.platforms.length, 1095, 35, 37, level.color);
    label('counter-label', 'MATERIALS', 1090, 81, 17, C.muted);
    rect('floor', 0, FLOOR, W, 32, C.ink);
    rect('floor-edge', 0, FLOOR, W, 5, level.color);
    // Foreground shop fixtures restore the tactile side-scroller read: tables,
    // shelves and recognizable machines sit in front of the generated room.
    legacy('table-left', 'Shelf', 18, 438, 170, 190, 0, 220);
    legacy('table-right', 'Shelf', 1100, 402, 145, 226, 0, 220);
    legacy('bench-left', 'Moving_Board', 30, 596, 250, 42, 0, 235);
    legacy('bench-mid', 'Moving_Board', 730, 596, 250, 42, 0, 235);
    const machine = ['CNC','SawStop','Bandsaw','Drill_Press'][levelIndex % 4];
    legacy('machine', machine, 875, 390, 180, 170, 0, 210);
    legacy('machine-small', ['Bandsaw','Drill_Press','CNC','SawStop'][(levelIndex+1) % 4], 260, 430, 135, 135, 0, 190);
    drawThemeProps();
    // A climbable, brightly marked ladder connects floor and upper platforms.
    rect('ladder-left', state.ladder.x, state.ladder.y, 9, state.ladder.h, level.color);
    rect('ladder-right', state.ladder.x + state.ladder.w - 9, state.ladder.y, 9, state.ladder.h, level.color);
    for (let r=0;r<10;r++) rect('ladder-rung'+r, state.ladder.x+5, state.ladder.y+18+r*34, state.ladder.w-10, 7, C.cream);
    label('ladder-label', 'CLIMB', state.ladder.x-6, state.ladder.y-29, 16, level.color);
    state.enemies.forEach((enemy,n) => {
      if (enemy.dead) return;
      // Shared Fly/FireVac silhouettes remain as occasional crossover props;
      // the composed foreground caricature is the active shop hazard.
      if (n === 1) legacy('enemy-crossover'+n, enemy.kind === 'Fly' ? 'Fly' : 'FireVac', enemy.x, enemy.y, 62, 62, 0, 80);
      drawThemeEnemy(enemy, n);
    });
    level.platforms.forEach(([x,y,w], n) => {
      rect('platform-shadow'+n, x+5, y+7, w, 17, C.dark, 200);
      rect('platform'+n, x, y, w, 17, C.panel);
      rect('platform-edge'+n, x, y, w, 5, level.color);
      for (let j=0;j<3;j++) rect('platform-bolt'+n+'-'+j, x+18+j*(w-36)/2, y+8, 4, 4, C.muted);
      if (!state.collected.includes(n)) {
        const cy = y-53+Math.sin(state.clock*3+n)*4;
        orb('pickup-halo'+n, x+w/2-29, cy-6, 58, level.color, 65);
        rect('pickup'+n, x+w/2-21, cy, 42, 39, level.color);
        const px=x+w/2;
        if(level.id==='woodshop') {
          for(let j=0;j<3;j++) rect('material'+n+'-'+j,px-15,cy+8+j*9,30,4,C.ink);
        } else if(level.id==='textiles') {
          rect('material'+n,px-13,cy+7,26,26,C.coral);
          for(let j=0;j<3;j++) rect('material-stitch'+n+'-'+j,px-10+j*8,cy+27,4,2,C.cream);
        } else if(level.id==='metalshop') {
          rect('material'+n,px-14,cy+7,28,25,C.ink); orb('material-hole'+n,px-7,cy+13,14,level.color);
        } else if(level.id==='electronics') {
          rect('material'+n,px-10,cy+8,20,22,C.ink);
          for(let j=0;j<3;j++) rect('material-pin'+n+'-'+j,px-16,cy+10+j*7,32,3,C.ink);
        } else if(level.id==='printmaking') {
          orb('material'+n,px-12,cy+8,24,[C.coral,C.teal,C.gold][n%3]); rect('material-lid'+n,px-12,cy+6,24,5,C.ink);
        } else {
          rect('material'+n,px-16,cy+11,32,17,C.cream); orb('material-cell'+n,px-6,cy+13,13,C.teal);
        }
      }
    });
    rect('moving-platform-shadow', movingX+5, 212, 170, 17, C.dark, 190);
    rect('moving-platform', movingX, 205, 170, 17, C.panel);
    rect('moving-platform-edge', movingX, 205, 170, 5, level.color);
    label('moving-platform-label', 'MOVING', movingX+47, 177, 15, level.color);
    // A visible destination, separate from the background's decorative machines.
    rect('bench-sign', 1050, 514, 200, 47, C.ink);
    label('bench-label', 'MAKING BENCH', 1065, 528, 19, level.color);
    rect('bench-top', 1080, 602, 160, 15, level.color);
    rect('bench-leg1', 1090, 617, 12, 25, C.muted); rect('bench-leg2', 1218, 617, 12, 25, C.muted);
    projectArt('bench-project-', level.id, 1160, 578, .22);
    const p = state.player;
    const robot = art('robot', 'MakerRobot', p.x-12, p.y-24, 88, 96);
    robot.setAnimationName(!p.grounded ? (p.vy < 0 ? 'Jump' : 'Fall') : p.vx ? 'Run' : 'Idle');
    robot.flipX(p.facing < 0);
    const near = p.x + p.w > 1025 && p.y + p.h > 555;
    if (near) {
      rect('interact-bg', 630, 583, 410, 44, C.ink);
      label('interact', state.collected.length===level.platforms.length ? 'X / Square  Make '+level.project : 'Find the glowing materials first', 646, 594, 20, level.color);
    }
    if (state.clock < 10 && state.collected.length === 0) {
      rect('tutorial-bg', 26, 430, 345, 68, C.ink, 245);
      label('tutorial', 'Stick to move. A / Cross to jump.\nClimb ladders. Stomp tool enemies.\nLand on shelves to gather materials.', 42, 425, 19);
    }
    footer('Stick / D-pad  Move     A / Cross  Jump     X / Square  Make     B / Circle  Map     START  Pause');
  }
  function drawBench() {
    art('backdrop', 'MakerBackdrop_'+level.id, 0, 0, W, H, 100);
    rect('bench-overlay', 0, 0, W, H, C.dark, 160);
    rect('bench-panel', 65, 32, 1150, 610, C.ink, 250);
    label('bench-kicker', level.title.toUpperCase()+'  /  TIME TO MAKE', 104, 60, 18, level.color);
    label('bench-title', 'Make '+level.project, 100, 91, 42);
    const kind = level.challenge;
    if (kind==='assemble' || kind==='pattern') {
      label('bench-directions', kind==='assemble' ? 'Choose the next part, then press A / Cross to assemble.' : 'Match the color sequence. Choose a thread, then press A / Cross.', 104, 152, 23, C.muted);
      label('bench-target', 'NEXT: '+level.parts[level.order[state.step]].toUpperCase(), 110, 222, 31, level.color);
      if (kind==='pattern') {
        level.order.forEach((v,n) => { rect('sequence'+n, 115+n*84, 295, 65, 65, [C.coral,C.gold,C.teal][v]); label('seq-mark'+n, n<state.step ? 'OK' : ''+(n+1), 128+n*84, 310, 26, C.ink); });
      } else label('assembly-step', 'Step '+(state.step+1)+' of 3\nBase, then walls, then roof.', 112, 291, 25);
      projectArt('project-', level.id, 935, 335, 1.15, kind==='assemble' ? state.step : 3);
      level.parts.forEach((part,n) => button('choice'+n, part, 110+n*225, 461, 202, state.choice===n, level.color));
    } else if (kind==='timing') {
      label('bench-directions', 'Press A / Cross when the marker is inside the gold zone.', 104, 152, 23, C.muted);
      label('timing-step', 'Join '+(state.step+1)+' of 3  /  '+level.parts[state.step], 110, 232, 30, level.color);
      rect('timing-track', 110, 330, 670, 52, C.panel);
      rect('timing-target', 110+670*.32, 325, 670*.36, 62, C.gold);
      rect('timing-marker', 110+((Math.sin(state.clock*1.8)+1)/2)*650, 313, 18, 86, C.cream);
      label('timing-help', 'Missed it? Keep trying. Your finished joins stay.', 110, 430, 22);
      projectArt('project-', level.id, 960, 335, 1.1);
    } else if (kind==='circuit') {
      label('bench-directions', 'Select a wire with left / right. A / Cross rotates it. Connect all three.', 104, 152, 23, C.muted);
      label('circuit-left', 'POWER', 112, 271, 22, level.color);
      label('circuit-right', 'LIGHT', 1040, 271, 22, level.color);
      rect('circuit-feed', 140, 348, 940, 10, C.muted);
      state.rotations.forEach((turn,n) => {
        const x=300+n*230;
        rect('wire-border'+n, x-5, 277, 150, 150, state.choice===n ? level.color : C.panel);
        rect('wire-tile'+n, x, 282, 140, 140, C.panel);
        rect('wire'+n, x+(turn%2 ? 65 : 0), 282+(turn%2 ? 0 : 65), turn%2 ? 10 : 140, turn%2 ? 140 : 10, level.color);
        label('wire-index'+n, 'WIRE '+(n+1), x+26, 450, 20);
      });
      orb('bulb', 1040, 315, 75, C.muted);
      label('circuit-help', 'A continuous horizontal path lights the LED.', 305, 508, 23);
    } else if (kind==='register') {
      label('bench-directions', 'Move the colored frame onto the cream target. Press A / Cross to print.', 104, 152, 23, C.muted);
      label('print-step', 'LAYER '+(state.step+1)+' / 3', 110, 233, 28, level.color);
      label('print-help', 'Stick / D-pad\nMove the frame\n\nA / Cross\nPrint this color', 110, 301, 23, C.muted);
      const x=590, y=270, size=200, col=[C.coral,C.teal,C.gold][state.step];
      rect('paper', 455, 211, 470, 366, '42;61;69');
      for (const [n,dx,dy,w,h] of [['t',0,0,size,5],['b',0,size,size,5],['l',0,0,5,size],['r',size,0,5,size]]) {
        rect('target-'+n,x+dx,y+dy,w,h,C.cream);
        rect('ink-'+n,x+dx+state.offset.x,y+dy+state.offset.y,w,h,col);
      }
      const aligned = Math.abs(state.offset.x)<=10 && Math.abs(state.offset.y)<=10;
      label('alignment', aligned ? 'ALIGNED! Press A / Cross' : 'Line up all four edges', 525, 536, 22, aligned ? C.gold : C.cream);
    } else if (kind==='focus') {
      const target=[45,70,30][state.step], sharp=Math.abs(state.focus-target)<=9;
      label('bench-directions', 'Use up / down to focus. Press A / Cross when the sample is sharp.', 104, 152, 23, C.muted);
      label('sample-title', 'SAMPLE '+(state.step+1)+' / 3: '+level.parts[state.step].toUpperCase(), 110, 227, 29, level.color);
      orb('scope-rim', 795, 210, 305, C.muted); orb('scope', 807, 222, 281, '30;68;65');
      for (let n=0;n<6;n++) {
        const x=850+(n%3)*65, y=295+Math.floor(n/3)*75;
        const spread=sharp ? 0 : Math.abs(state.focus-target)*.27;
        orb('cell-blur'+n,x-spread,y-spread,45+spread*2,level.color,sharp ? 0 : 60);
        if(state.step===0) rect('cell'+n,x,y,47,43,level.color,sharp ? 255 : 100);
        else orb('cell'+n,x,y,state.step===1 ? 45 : 36,level.color,sharp ? 255 : 100);
        if(state.step===2) orb('bud'+n,x+23,y-8,22,level.color,sharp ? 255 : 100);
        if(state.step===1) for(let j=0;j<6;j++) orb('pollen'+n+'-'+j,x+18+Math.cos(j*Math.PI/3)*23,y+18+Math.sin(j*Math.PI/3)*23,8,C.gold,sharp ? 255 : 70);
        orb('nucleus'+n,x+15,y+15,14,C.gold,sharp ? 255 : 50);
      }
      rect('focus-track', 110, 350, 540, 24, C.panel);
      rect('focus-target', 110+(target-9)*5.4, 345, 18*5.4, 34, C.gold);
      rect('focus-marker', 110+state.focus*5.4, 335, 8, 55, C.cream);
      label('focus-help', sharp ? 'IN FOCUS!  A / Cross to record' : 'UP increases focus. DOWN decreases it.', 110, 425, 23, sharp ? C.gold : C.cream);
    }
    if (state.feedbackUntil > state.clock) label('bench-feedback', state.feedback, 108, 574, 20, C.gold);
    footer('Stick / D-pad  Adjust     A / Cross  Make     B / Circle  Back to shop     START  Pause');
  }
  function drawComplete() {
    art('backdrop', 'MakerBackdrop_'+level.id, 0, 0, W, H, 95);
    rect('complete-panel', 58, 40, 1164, 604, C.ink, 248);
    label('complete-kicker', 'MADE AT MAKEHAVEN', 105, 81, 20, level.color);
    label('complete-title', 'You made '+level.project+'!', 101, 126, 40);
    projectArt('finished-', level.id, 955, 353, 1.2);
    label('complete-body', level.fact.replace(/(.{1,54})(\s|$)/g, '$1\n').trim(), 108, 226, 26);
    label('complete-invite', level.invitation.replace(/(.{1,56})(\s|$)/g, '$1\n').trim(), 108, 351, 23, C.muted);
    label('complete-count', session.badges.length===6 ? 'ALL SIX SHOPS EXPLORED. What will you make for real?' : session.badges.length+' of 6 shop badges collected this visit', 108, 459, 21, level.color);
    button('complete-next', 'A / Cross  Choose another shop', 108, 531, 425, true, level.color);
    button('complete-home', 'B / Circle  Finish visit', 567, 531, 330);
    footer('Your next project could happen right here. Ask a facilitator how to start.');
  }
  function drawOverlay(title, body, controls) {
    rect('overlay-dim', 0, 0, W, H, C.dark, 215);
    rect('overlay-card', 270, 200, 740, 290, C.panel);
    label('overlay-title', title, 315, 242, 38);
    label('overlay-body', body, 315, 310, 24, C.muted);
    label('overlay-controls', controls, 315, 402, 23, C.gold);
  }
  function render() {
    state.used.clear(); z = 0;
    if (state.mode === 'title') drawTitle();
    if (state.mode === 'map') drawMap();
    if (state.mode === 'explore') drawExplore();
    if (state.mode === 'bench') drawBench();
    if (state.mode === 'complete') drawComplete();
    if (state.mode==='explore' && state.feedbackUntil>state.clock) {
      rect('feedback-bg', 225, 140, 830, 43, C.ink);
      label('feedback', state.feedback, 242, 151, 21, C.gold);
    }
    if (state.paused) drawOverlay('Take a breather.', 'Your materials and project are right here.', 'START  Resume     B / Circle  Shop map     SELECT  Sound');
    if (state.disconnected && state.mode!=='title') drawOverlay('Controller disconnected', 'Reconnect a gamepad and press a button.\nYour progress is waiting here.', 'Keyboard also works: arrows, Space, E, Escape');
    const idle = (Date.now()-session.lastActivity)/1000;
    if (idle>70 && state.mode!=='title') {
      rect('idle-bg', 370, 620, 540, 43, C.dark);
      label('idle', 'Still making? Press a button. Reset in '+Math.ceil(90-idle)+'s', 389, 631, 21, C.gold);
    }
    for (const [key,o] of state.objects) if (!state.used.has(key)) o.hide(true);
  }
  function tick() {
    const now=Date.now(); const dt=Math.min(.05, Math.max(0,(now-state.previousTime)/1000)); state.previousTime=now;
    poll();
    if (state.mode!=='title' && now-session.lastActivity>90000) { home(); return; }
    if (state.edge.mute) { session.muted=!session.muted; sound(); }
    if (!state.disconnected) {
      if (state.edge.start && level && state.mode!=='complete') state.paused=!state.paused;
      if (!state.paused) state.clock+=dt;
      const e=state.edge;
      if (state.paused) { if(e.b) {go('Shop Map');return;} }
      else {
        const move=nav();
        if (state.mode==='title' && (e.a || e.start)) { session.badges=[]; go('Shop Map'); return; }
        if (state.mode==='map') {
          const row=Math.floor(state.selected/3), col=state.selected%3;
          state.selected=((row+move.y+2)%2)*3+(col+move.x+3)%3;
          session.selected=state.selected;
          if (e.a || e.x) { go(MAKER_LEVELS[state.selected].scene); return; }
          if (e.b) { home(); return; }
        }
        if (state.mode==='explore') {
          if (e.b) { go('Shop Map'); return; }
          if (e.a) state.player.buffer=.14;
          if (e.y) { Object.assign(state.player,{x:65,y:FLOOR-72,vy:0}); feedback('Back at the entrance. Your materials are safe.'); }
          state.accumulator+=dt;
          while(state.accumulator>=1/120) {physics(1/120);state.accumulator-=1/120;}
          const near=state.player.x+state.player.w>1025 && state.player.y+state.player.h>555;
          if(e.x && near) {
            if(state.collected.length===level.platforms.length) {state.mode='bench';state.feedback='';}
            else feedback('Collect all '+level.platforms.length+' glowing materials, then come back.');
          }
        } else if (state.mode==='bench') {
          if(e.b) state.mode='explore'; else benchUpdate(dt,move);
        } else if (state.mode==='complete' && state.clock-state.completedAt>.65) {
          if(e.a || e.x) { session.selected=(levelIndex+1)%6;go('Shop Map');return; }
          if(e.b) {home();return;}
        }
      }
    }
    render();
  }
  runtimeScene._maker = { tick, state, session, physics };
  // Explicit opt-in for browser acceptance tests; absent in ordinary kiosk URLs.
  if (typeof location!=='undefined' && new URLSearchParams(location.search).has('test')) {
    window.__makehaven = {
      snapshot: () => ({ scene: sceneName, mode: state.mode, collected: [...state.collected], badges: [...session.badges], selected: state.selected, paused: state.paused, disconnected: state.disconnected, player: {...state.player}, step: state.step, rotations: [...state.rotations], offset: {...state.offset}, focus: state.focus, clock: state.clock }),
      placePlayer: (x,y) => Object.assign(state.player,{x,y,vy:0}),
      idleFor: seconds => {session.lastActivity=Date.now()-seconds*1000;},
    };
  }
}
runtimeScene._maker.tick();
