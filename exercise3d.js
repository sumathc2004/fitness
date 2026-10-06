// 3D animated exercise demos. A procedural mannequin (forward kinematics + 2-bone IK) performs each lift in real time.
// Rendered with Three.js (loaded on demand); falls back to a 2D side-view animation if WebGL / the CDN is unavailable.
const SVDExercise = (() => {
  // ---------- body model (metres) ----------
  const TL = .52, NK = .13, UA = .30, FA = .27, TH = .43, SH = .42, FT = .20, AH = .045;
  const rad = d => d * Math.PI / 180, L = (a, b, w) => a + (b - a) * w;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k], len = a => Math.hypot(a[0], a[1]);
  const vec = th => [Math.sin(rad(th)), -Math.cos(rad(th))];            // limb angle: 0 = straight down, + = forward (+x)
  const up = t => [Math.sin(rad(t)), Math.cos(rad(t))];                  // torso angle: 0 = straight up, + = leaning forward
  const SP = (P, t) => add(P, mul(up(t), TL));                           // shoulder position from pelvis + torso angle

  // 2-bone IK in the x/y plane; picks the joint solution closest to `pref`
  const ik = (p, q, l1, l2, pref) => {
    const d = sub(q, p), dist = len(d), dd = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
    const u = dist > 1e-6 ? mul(d, 1 / dist) : [1, 0], a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    const mid = add(p, mul(u, a)), n = [-u[1], u[0]], e1 = add(mid, mul(n, h)), e2 = add(mid, mul(n, -h));
    const sc = e => (e[0] - mid[0]) * pref[0] + (e[1] - mid[1]) * pref[1];
    return [sc(e1) >= sc(e2) ? e1 : e2, add(p, mul(u, dd))];
  };

  const solve = pose => {
    const t = pose.t || 0;
    let P = pose.P, S = pose.S;
    if (!P) P = sub(S, mul(up(t), TL)); else S = SP(P, t);
    const hv = up(t + (pose.hd || 0)), N = add(S, mul(hv, NK)), Hc = add(N, mul(hv, .1)), fwd = [Math.cos(rad(t)), -Math.sin(rad(t))];
    const legs = pose.feet
      ? pose.feet.map(f => { const [K, A] = ik(P, f.a, TH, SH, f.kb || [1, .1]), r = rad(f.f || 0); return { K, A, T: add(A, [FT * Math.cos(r), -FT * Math.sin(r)]) }; })
      : pose.legsFK.map(l => { const K = add(P, mul(vec(l[0]), TH)), sv = vec(l[1]), A = add(K, mul(sv, SH)); return { K, A, T: add(A, mul([-sv[1], sv[0]], FT)) }; });
    const h = pose.hands; let E, W;
    if (h.fk) { let [ua, fa] = h.fk; if (h.rigid) { ua -= t; fa -= t; } E = add(S, mul(vec(ua), UA)); W = add(E, mul(vec(fa), FA)); }
    else {
      const target = h.w === 'head' ? add(Hc, mul(fwd, -.07)) : h.w === 'hang' ? add(S, [h.dx || 0, -.56]) : h.w;
      [E, W] = ik(S, target, UA, FA, h.bend || [0, -1]);
    }
    return { t, ha: t + (pose.hd || 0), P, S, N, Hc, legs, E, W, bar: pose.bar === 'wrist' ? W : pose.bar || null };
  };

  // ---------- exercise library ----------
  const stand = (extra, P = [0, .893]) => ({ P, feet: [{ a: [0, AH] }], ...extra });
  const planker = (hS, t0, arms) => {            // body on toes + hands/forearms; straight line from ankle to shoulder
    const A = [-1.25, .22], s = Math.max(-1, Math.min(1, (hS - A[1]) / 1.37)), phi = Math.asin(s), d = [Math.cos(phi), Math.sin(phi)];
    const S = add(A, mul(d, 1.37)), P = add(A, mul(d, .85));
    return { t: 90 - phi * 180 / Math.PI, hd: t0, P, feet: [{ a: A, f: 60 }], hands: arms(S) };
  };
  const EX = [
    { id: 'squat', name: 'Barbell Back Squat', re: /squat/, level: 'Intermediate', muscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'], focus: { thighs: 1, shins: 1, glutes: 1 },
      phases: ['Lower down', 'Drive up'], bar: 'barbell', cam: { t: [0, .85, 0], r: 3.4 },
      pose: w => stand({ t: L(5, 42, w), hd: L(0, -14, w), hands: { fk: [-45, 149], rigid: true }, bar: 'wrist' }, [L(0, -.19, w), L(.893, .38, w)]),
      steps: ['Set the bar on your upper back (not your neck). Feet shoulder-width, toes turned out slightly.', 'Brace your core, chest proud, eyes forward.', 'Push hips back and bend knees together — sit down between your heels.', 'Lower until thighs are at least parallel to the floor, knees tracking over toes.', 'Drive through your whole foot to stand, squeezing glutes at the top.'],
      mistakes: ['Knees caving inward', 'Heels lifting off the floor', 'Rounding the lower back at the bottom'], tip: 'Aim for 3–5 sets of 5–8 reps with a 2-second descent.', breath: 'Breathe in on the way down, out as you stand.' },
    { id: 'deadlift', name: 'Deadlift', re: /dead\s?lift|rdl|romanian/, level: 'Intermediate', muscles: ['Hamstrings', 'Glutes', 'Lower back', 'Traps'], focus: { thighs: 1, glutes: 1, torso: 1, uarms: 0 },
      phases: ['Pull from floor', 'Lower with control'], bar: 'barbell', cam: { t: [0, .8, 0], r: 3.4 },
      pose: w => ({ t: L(48, -2, w), hd: L(-8, 0, w), P: [L(-.17, 0, w), L(.45, .893, w)], feet: [{ a: [0, AH] }], hands: { w: 'hang', dx: 0 }, bar: 'wrist' }),
      steps: ['Stand with the bar over mid-foot, feet hip-width.', 'Hinge at the hips, bend knees, and grip the bar just outside your legs.', 'Chest up, back flat, shoulders over the bar, arms straight.', 'Push the floor away — hips and shoulders rise together, bar stays close to your legs.', 'Stand tall and squeeze glutes. Lower by pushing hips back first, then bending knees.'],
      mistakes: ['Rounding the back', 'Bar drifting away from the legs', 'Jerking the bar off the floor'], tip: 'Start light: 3–4 sets of 4–6 reps. Reset between every rep.', breath: 'Big breath and brace before lifting; exhale at lockout.' },
    { id: 'bench', name: 'Barbell Bench Press', re: /bench|chest press|incline|dumbbell press|db press/, level: 'Beginner', muscles: ['Chest', 'Triceps', 'Front delts'], focus: { torso: 1, uarms: 1 },
      phases: ['Lower to chest', 'Press up'], bar: 'barbell', props: 'bench', cam: { t: [-.3, .8, 0], r: 3.4, az: 25 },
      pose: w => { const P = [0, .55], S = SP(P, -90); return { t: -90, P, feet: [{ a: [.5, AH] }], hands: { w: [L(S[0] + .02, S[0] + .14, w), L(S[1] + .56, .72, w)], bend: [0, -1] }, bar: 'wrist' }; },
      steps: ['Lie back with eyes under the bar, feet flat, shoulder blades pinched together.', 'Grip slightly wider than shoulders and unrack with straight arms.', 'Lower the bar under control to your mid-chest, elbows about 45° from your body.', 'Press the bar up and slightly back over your shoulders until arms are straight.', 'Keep your glutes on the bench and wrists stacked over elbows throughout.'],
      mistakes: ['Bouncing the bar off the chest', 'Flaring elbows to 90°', 'Lifting hips off the bench'], tip: 'Use a spotter for heavy sets. 3–4 sets of 6–10 reps.', breath: 'Inhale as you lower, exhale as you press.' },
    { id: 'ohp', name: 'Overhead Press', re: /overhead|shoulder press|military|\bohp\b/, level: 'Intermediate', muscles: ['Shoulders', 'Triceps', 'Upper chest', 'Core'], focus: { uarms: 1, shoulders: 1, torso: 0 },
      phases: ['Press overhead', 'Lower to shoulders'], bar: 'barbell', cam: { t: [0, 1.1, 0], r: 3.8 },
      pose: w => { const t = L(0, -5, w), S = SP([0, .893], t), r0 = add(S, [.09, .03]), r1 = add(S, [.02, .555]); return stand({ t, hands: { w: [L(r0[0], r1[0], w), L(r0[1], r1[1], w)], bend: [.5, -1] }, bar: 'wrist' }); },
      steps: ['Hold the bar at collarbone height, grip just outside shoulders, elbows slightly forward.', 'Squeeze glutes and brace your core — ribs down.', 'Press the bar straight up, moving your head back then through once it passes your face.', 'Lock out overhead with the bar over mid-foot.', 'Lower under control back to your collarbone.'],
      mistakes: ['Over-arching the lower back', 'Pressing the bar out in front', 'Using leg drive on strict sets'], tip: '3–4 sets of 6–10 reps.', breath: 'Breathe in at the bottom, out at lockout.' },
    { id: 'pushup', name: 'Push-up', re: /push[\s-]?up|press[\s-]?up/, level: 'Beginner', muscles: ['Chest', 'Triceps', 'Shoulders', 'Core'], focus: { torso: 1, uarms: 1, farms: 0 },
      phases: ['Lower chest', 'Push up'], cam: { t: [-.5, .45, 0], r: 3.6, az: 20 }, props: 'mat',
      pose: w => planker(L(.61, .27, w), -35, S => ({ w: [S[0], .045], bend: [-1, .3] })),
      steps: ['Hands slightly wider than shoulders, body in a straight line from head to heels.', 'Brace your core and squeeze glutes — no sagging hips.', 'Lower your chest toward the floor, elbows about 45° from your body.', 'Pause just above the floor, then push the floor away until arms are straight.', 'Keep your neck neutral — look a little ahead of your hands.'],
      mistakes: ['Sagging hips', 'Flaring elbows straight out', 'Half reps'], tip: 'Too hard? Do them with hands on a bench. 3 sets to near-failure.', breath: 'In on the way down, out on the way up.' },
    { id: 'curl', name: 'Dumbbell Biceps Curl', re: /curl|bicep/, level: 'Beginner', muscles: ['Biceps', 'Forearms'], focus: { uarms: 1, farms: 1 },
      phases: ['Curl up', 'Lower slowly'], bar: 'db', cam: { t: [0, .95, 0], r: 3.6, az: 40 },
      pose: w => stand({ hands: { fk: [L(2, 6, w), L(0, 152, w)] }, bar: 'wrist' }),
      steps: ['Stand tall, dumbbells at your sides, palms forward, elbows pinned to your ribs.', 'Curl the weights up by bending only at the elbows.', 'Squeeze your biceps at the top without letting shoulders roll forward.', 'Lower for a slow 3-count until arms are almost straight.'],
      mistakes: ['Swinging the torso', 'Elbows drifting forward', 'Dropping the weight fast'], tip: '3 sets of 10–15 reps.', breath: 'Exhale as you curl, inhale as you lower.' },
    { id: 'lunge', name: 'Split Lunge', re: /lunge|split squat/, level: 'Beginner', muscles: ['Quads', 'Glutes', 'Hamstrings'], focus: { thighs: 1, shins: 1, glutes: 1 },
      phases: ['Lower down', 'Drive up'], cam: { t: [0, .7, 0], r: 3.4, az: 15 },
      pose: w => ({ t: 2, P: [0, L(.76, .42, w)], feet: [{ a: [.45, AH] }, { a: [-.45, .209], f: 55, kb: [.2, -1] }], hands: { fk: [0, 6] } }),
      steps: ['Take a long stride forward and stay on the ball of your back foot.', 'Keep your torso tall and core tight.', 'Lower straight down until your back knee almost touches the floor.', 'Front knee stays over your ankle, front heel planted.', 'Push through the front heel to rise. Finish all reps, then switch legs.'],
      mistakes: ['Front knee collapsing inward', 'Leaning far forward', 'Stride too short'], tip: '3 sets of 8–12 reps per leg.', breath: 'In going down, out coming up.' },
    { id: 'row', name: 'Bent-over Barbell Row', re: /\brow\b|rows/, level: 'Intermediate', muscles: ['Lats', 'Mid back', 'Biceps', 'Rear delts'], focus: { torso: 1, uarms: 1, farms: 1 },
      phases: ['Row to waist', 'Lower with control'], bar: 'barbell', cam: { t: [0, .75, 0], r: 3.4 },
      pose: w => { const P = [-.33, .70], t = 62, S = SP(P, t), b0 = add(S, [0, -.56]), b1 = [S[0] - .1, S[1] - .24]; return { t, hd: -22, P, feet: [{ a: [0, AH] }], hands: { w: [L(b0[0], b1[0], w), L(b0[1], b1[1], w)], bend: [-1, .4] }, bar: 'wrist' }; },
      steps: ['Hinge forward with a flat back until your torso is about 30° from parallel, knees soft.', 'Let the bar hang at arm\'s length below your shoulders.', 'Pull the bar toward your lower ribs, driving elbows back.', 'Squeeze your shoulder blades at the top.', 'Lower slowly — don\'t let your torso rise.'],
      mistakes: ['Standing up as you pull', 'Rounded lower back', 'Yanking with momentum'], tip: '3–4 sets of 8–12 reps.', breath: 'Exhale as you row, inhale as you lower.' },
    { id: 'pullup', name: 'Pull-up', re: /pull[\s-]?up|chin[\s-]?up|lat pull/, level: 'Advanced', muscles: ['Lats', 'Biceps', 'Upper back', 'Core'], focus: { torso: 1, uarms: 1, farms: 1 },
      phases: ['Pull chin over bar', 'Lower to hang'], props: 'pullup', cam: { t: [0, 1.4, 0], r: 4.3, az: 20 },
      pose: w => ({ t: L(-3, -18, w), hd: L(0, -20, w), S: [L(0, .06, w), L(1.64, 2.08, w)], legsFK: [[2, -55], [2, -55]], hands: { w: [0, 2.2], bend: [-.3, -1] } }),
      steps: ['Grab the bar slightly wider than shoulders, palms facing away, and hang with straight arms.', 'Pull your shoulder blades down, then drive elbows toward your hips.', 'Pull until your chin clears the bar — chest to the bar if you can.', 'Lower slowly all the way back to a dead hang.', 'Avoid kicking or swinging.'],
      mistakes: ['Kipping / swinging', 'Partial range of motion', 'Shrugging shoulders to the ears'], tip: 'Can\'t do one yet? Use a band or negatives (lower for 5 seconds).', breath: 'Exhale as you pull, inhale as you lower.' },
    { id: 'plank', name: 'Forearm Plank', re: /plank/, level: 'Beginner', muscles: ['Core', 'Shoulders', 'Glutes'], focus: { torso: 1, glutes: 1 }, hold: true,
      phases: ['Hold steady', 'Breathe'], cam: { t: [-.5, .35, 0], r: 3.4, az: 20 }, props: 'mat',
      pose: w => planker(L(.35, .36, w), -25, S => ({ w: [S[0] + .27, .045], bend: [0, -1] })),
      steps: ['Place elbows under shoulders, forearms on the floor.', 'Walk feet back so your body is one straight line.', 'Squeeze glutes, brace abs as if bracing for a punch.', 'Keep hips level — no sagging or piking.', 'Hold for 20–60 seconds while breathing steadily.'],
      mistakes: ['Hips sagging', 'Hips too high', 'Holding your breath'], tip: '3 holds of 30–60 seconds.', breath: 'Slow, steady breaths — never hold.' },
    { id: 'crunch', name: 'Crunch', re: /crunch|sit[\s-]?up|\babs?\b/, level: 'Beginner', muscles: ['Abs'], focus: { torso: 1 },
      phases: ['Curl up', 'Lower slowly'], props: 'mat', cam: { t: [-.1, .3, 0], r: 2.8, az: 15 },
      pose: w => ({ t: L(-90, -52, w), P: [0, .1], feet: [{ a: [.5, AH], kb: [0, 1] }], hands: { w: 'head', bend: [0, 1] } }),
      steps: ['Lie on your back, knees bent, feet flat.', 'Hands lightly behind your head — don\'t pull on your neck.', 'Exhale and curl your ribs toward your hips, lifting shoulder blades off the floor.', 'Pause briefly, then lower slowly.'],
      mistakes: ['Pulling on the neck', 'Using momentum', 'Lifting the lower back off the floor'], tip: '3 sets of 15–20 slow reps.', breath: 'Exhale as you curl up.' },
    { id: 'calf', name: 'Standing Calf Raise', re: /calf/, level: 'Beginner', muscles: ['Calves'], focus: { shins: 1 },
      phases: ['Rise onto toes', 'Lower heels'], cam: { t: [0, .95, 0], r: 3.9, az: 40 },
      pose: w => { const f = L(0, 50, w), A = [.2 - .2 * Math.cos(rad(f)), .045 + .2 * Math.sin(rad(f))]; return { t: 0, P: [A[0], A[1] + .848], feet: [{ a: A, f }], hands: { fk: [0, 4] } }; },
      steps: ['Stand tall with the balls of your feet on the floor or a step.', 'Rise as high as you can onto your toes.', 'Pause and squeeze your calves for a second.', 'Lower slowly until your heels are below the step if possible.'],
      mistakes: ['Bouncing', 'Bending the knees', 'Short range of motion'], tip: '3–4 sets of 12–20 reps.', breath: 'Exhale up, inhale down.' }
  ];
  // where it works (lime) and form watch-points (orange); anchors are body locations
  const LABELS = {
    squat: { works: [['quads', 'Quads'], ['glutes', 'Glutes'], ['core', 'Core']], watch: [['knees', 'Knees', 'Track over toes'], ['lowerback', 'Lower back', 'Stay neutral']] },
    deadlift: { works: [['glutes', 'Glutes'], ['quads', 'Hamstrings'], ['upperback', 'Traps & lats']], watch: [['lowerback', 'Lower back', 'Keep it flat'], ['neck', 'Neck', 'Stay neutral']] },
    bench: { works: [['chest', 'Chest'], ['biceps', 'Triceps'], ['shoulders', 'Front delts']], watch: [['shoulders', 'Shoulders', 'Blades pinched'], ['wrists', 'Wrists', 'Stack over elbows']] },
    ohp: { works: [['shoulders', 'Shoulders'], ['biceps', 'Triceps'], ['core', 'Core']], watch: [['lowerback', 'Lower back', "Don't over-arch"], ['wrists', 'Wrists', 'Stay straight']] },
    pushup: { works: [['chest', 'Chest'], ['biceps', 'Triceps'], ['core', 'Core']], watch: [['lowerback', 'Hips', 'No sagging'], ['elbows', 'Elbows', 'About 45°']] },
    curl: { works: [['biceps', 'Biceps'], ['forearms', 'Forearms']], watch: [['elbows', 'Elbows', 'Keep pinned'], ['lowerback', 'Torso', 'No swinging']] },
    lunge: { works: [['quads', 'Quads'], ['glutes', 'Glutes']], watch: [['knees', 'Front knee', 'Over the ankle'], ['spine', 'Torso', 'Stay tall']] },
    row: { works: [['lats', 'Lats'], ['upperback', 'Mid back'], ['biceps', 'Biceps']], watch: [['lowerback', 'Lower back', 'Keep it flat'], ['neck', 'Neck', 'Stay neutral']] },
    pullup: { works: [['lats', 'Lats'], ['biceps', 'Biceps'], ['upperback', 'Upper back']], watch: [['shoulders', 'Shoulders', 'Down, not shrugged'], ['core', 'Core', 'No swinging']] },
    plank: { works: [['core', 'Core'], ['shoulders', 'Shoulders'], ['glutes', 'Glutes']], watch: [['lowerback', 'Hips', 'Keep level'], ['neck', 'Neck', 'Stay neutral']] },
    crunch: { works: [['core', 'Abs']], watch: [['neck', 'Neck', "Don't pull"], ['lowerback', 'Lower back', 'Stays down']] },
    calf: { works: [['calves', 'Calves']], watch: [['knees', 'Knees', 'Stay straight'], ['ankles', 'Ankles', 'Control the lower']] }
  };
  const ZONE = { bench: [.5, 1], pushup: [.5, 1], ohp: [.55, 1], deadlift: [.05, .75], row: [.35, .95], pullup: [.3, .95], plank: [.1, .7], crunch: [.12, .6] };
  EX.forEach(e => { e.labels = LABELS[e.id]; e.zone = ZONE[e.id] || [0, 1]; });
  const find = name => EX.find(e => e.re.test((name || '').toLowerCase())) || null;

  // ---------- timing ----------
  const ease = x => .5 - .5 * Math.cos(Math.PI * x);
  const wOf = (u, hold) => { const a = .46, h = .04; if (hold) return .5 - .5 * Math.cos(u * 2 * Math.PI); return u < a ? ease(u / a) : u < a + h ? 1 : u < 2 * a + h ? 1 - ease((u - a - h) / a) : 0; };
  const phaseOf = (u, ex) => ex.hold ? ex.phases[u < .5 ? 0 : 1] : u < .46 ? ex.phases[0] : u < .5 ? 'Hold' : u < .96 ? ex.phases[1] : 'Reset';

  // ---------- Three.js renderer ----------
  let threeP;
  const loadThree = () => threeP = threeP || new Promise(res => {
    if (window.THREE) return res(true);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
  });

  const makeThree = (canvas, wrap, labelsEl) => {
    const T = window.THREE;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 60);
    scene.fog = new T.Fog(0x080b0a, 7, 15);
    scene.add(new T.HemisphereLight(0xffffff, 0x1d2a22, .9));
    const key = new T.DirectionalLight(0xffffff, 1); key.position.set(3, 5.5, 3.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 15 }); scene.add(key);
    const fill = new T.DirectionalLight(0xbfd8ff, .35); fill.position.set(-3, 2, 2); scene.add(fill);
    const rim = new T.PointLight(0xc8ff2e, .8, 12); rim.position.set(-3, 2.2, -2.5); scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(3.4, 64), new T.MeshStandardMaterial({ color: 0x0f1613, roughness: .95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(6.8, 34, 0x3a5516, 0x1a251c); grid.position.y = .003; scene.add(grid);
    const ring = new T.Mesh(new T.RingGeometry(1.45, 1.47, 96), new T.MeshBasicMaterial({ color: 0xc8ff2e, transparent: true, opacity: .35, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .006; scene.add(ring);

    const mk = (geo, mat) => { const m = new T.Mesh(geo, mat); m.castShadow = true; return m; };
    const V = (p, z) => new T.Vector3(p[0], p[1], z), _a = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _z = new T.Vector3(0, 0, 1);
    const place = (m, a, b, sx = 1, sz = 1) => {
      const d = _a.copy(b).sub(a), l = d.length() || .001; m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(_up, d.divideScalar(l)); m.scale.set(sx, l, sz);
    };
    const mix3 = (a, b, t) => a.clone().lerp(b, t);

    // organic limbs: lathe profiles [t along the limb 0..1, radius in metres]
    const lathe = prof => { const g = new T.LatheGeometry(prof.map(([t, r]) => new T.Vector2(r, t)), 24); g.translate(0, -.5, 0); return g; };
    const radAt = (prof, t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) { const [t0, r0] = prof[i - 1], [t1, r1] = prof[i]; return r0 + (r1 - r0) * ((t - t0) / ((t1 - t0) || 1)); } return prof[prof.length - 1][1]; };
    const sub = (prof, t0, t1, off = 0, n = 12) => Array.from({ length: n + 1 }, (_, i) => [i / n, radAt(prof, t0 + (t1 - t0) * i / n) + off]);
    const sc = (p, k) => p.map(([t, r]) => [t, r * k]);
    const LP = {
      thigh: [[0, .088], [.12, .095], [.4, .091], [.7, .071], [.9, .056], [1, .05]], shin: [[0, .05], [.22, .06], [.4, .057], [.75, .04], [1, .032]],
      uarm: [[0, .052], [.3, .055], [.62, .047], [1, .039]], farm: [[0, .039], [.22, .042], [.7, .031], [1, .025]], shoe: [[0, .052], [.55, .056], [1, .038]]
    };
    const TYPES = {
      m: { zS: .205, zH: .1, k: 1, tw: 1.3, td: .78, shirt: 0x1f8a9a, shorts: 0x1b2230, hair: 0x2a1c14, bust: false, shortsFrac: .52,
        torso: [[0, .135], [.15, .145], [.4, .13], [.62, .14], [.82, .167], [.96, .15], [1, .105]] },
      f: { zS: .17, zH: .114, k: .9, tw: 1.24, td: .78, shirt: 0xff6b57, shorts: 0x222733, hair: 0x3b2417, bust: true, ponytail: true, shortsFrac: .42,
        torso: [[0, .14], [.15, .152], [.4, .113], [.62, .126], [.82, .147], [.96, .137], [1, .095]] }
    };
    const TONES = [0xf1c9a8, 0xd9a27d, 0x8f5d3f];
    const SPH = new T.SphereGeometry(1, 28, 18);
    let toneI = 1;

    const buildBody = g => {
      const ty = TYPES[g], k = ty.k, grp = new T.Group(), Q = {}, HL = [];
      const M = {
        skin: new T.MeshStandardMaterial({ color: TONES[toneI], roughness: .6 }), shirt: new T.MeshStandardMaterial({ color: ty.shirt, roughness: .9 }),
        shorts: new T.MeshStandardMaterial({ color: ty.shorts, roughness: .85 }), shoe: new T.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .5 }),
        sole: new T.MeshStandardMaterial({ color: 0xc8ff2e, roughness: .5 }), hair: new T.MeshStandardMaterial({ color: ty.hair, roughness: .65 }), dark: new T.MeshStandardMaterial({ color: 0x16110d, roughness: .35 }),
        hl: new T.MeshBasicMaterial({ color: 0xc8ff2e, transparent: true, opacity: .25, blending: T.AdditiveBlending, depthWrite: false })
      };
      const GEO = { thigh: lathe(sc(LP.thigh, k)), shin: lathe(sc(LP.shin, k)), uarm: lathe(sc(LP.uarm, k)), farm: lathe(sc(LP.farm, k)), shoe: lathe(LP.shoe), torso: lathe(ty.torso),
        shortsThigh: lathe(sub(sc(LP.thigh, k), 0, ty.shortsFrac, .012)), sleeve: lathe(sub(sc(LP.uarm, k), 0, .58, .01)), tube: lathe([[0, 1], [1, 1]]) };
      const add = (name, geo, mat, cast = true) => { const o = new T.Mesh(geo, mat); o.castShadow = cast; grp.add(o); Q[name] = o; return o; };
      const hl = (name, geo, groupName) => { const o = new T.Mesh(geo, M.hl); o.renderOrder = 5; grp.add(o); Q[name] = o; HL.push({ o, g: groupName }); return o; };
      const ball = (name, mat, rx, ry, rz) => { const o = add(name, SPH, mat); o.scale.set(rx, ry, rz); return o; };

      add('torso', GEO.torso, M.shirt); add('neck', GEO.tube, M.skin); ball('pelvis', M.shorts, .15 * .85, .125, .15 * 1.32);
      add('shLine', GEO.tube, M.shirt); ball('chestCap', M.shirt, .105 * .8, .06, .2 * (ty.zS / .205) * 1.1);
      if (ty.bust) [1, -1].forEach(s => ball('bust' + (s > 0 ? 'R' : 'L'), M.shirt, .062, .062, .062));
      // head, hair, face
      const head = new T.Group(); grp.add(head); Q.head = head;
      const hm = mk(SPH, M.skin); hm.scale.set(.1, .118, .088); head.add(hm);
      const hair = mk(new T.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * .6), M.hair); hair.scale.set(.108, .127, .096); hair.position.set(-.008, .005, 0); head.add(hair);
      [-1, 1].forEach(z => { const e = new T.Mesh(SPH, M.dark); e.scale.setScalar(.011); e.position.set(.088, .018, z * .036); head.add(e); const ear = mk(SPH, M.skin); ear.scale.set(.018, .028, .011); ear.position.set(-.004, -.004, z * .088); head.add(ear); });
      const nose = mk(SPH, M.skin); nose.scale.set(.017, .017, .014); nose.position.set(.1, -.008, 0); head.add(nose);
      if (ty.ponytail) [[-.105, .02, .04], [-.145, -.025, .034], [-.168, -.085, .027], [-.172, -.14, .02]].forEach(([x, y, r]) => { const p = mk(SPH, M.hair); p.scale.setScalar(r); p.position.set(x, y, 0); head.add(p); });
      // limbs
      [1, -1].forEach(s => {
        const n = s > 0 ? 'R' : 'L';
        add('sho' + n, SPH, M.shirt).scale.setScalar(.063 * k + .005);
        add('ua' + n, GEO.uarm, M.skin); add('sl' + n, GEO.sleeve, M.shirt); add('fa' + n, GEO.farm, M.skin);
        ball('elb' + n, M.skin, .042 * k, .042 * k, .042 * k); ball('hand' + n, M.skin, .04, .05, .03);
        add('th' + n, GEO.thigh, M.skin); add('sr' + n, GEO.shortsThigh, M.shorts); add('sh' + n, GEO.shin, M.skin);
        ball('knee' + n, M.skin, .05 * k, .05 * k, .05 * k); ball('ank' + n, M.skin, .036, .036, .036);
        add('shoe' + n, GEO.shoe, M.shoe); ball('heel' + n, M.shoe, .054, .05, .05); ball('toe' + n, M.sole, .02, .02, .052);
        hl('uaH' + n, GEO.uarm, 'uarms'); hl('faH' + n, GEO.farm, 'farms'); hl('thH' + n, GEO.thigh, 'thighs'); hl('shH' + n, GEO.shin, 'shins'); hl('shoH' + n, SPH, 'shoulders');
      });
      hl('torsoH', GEO.torso, 'torso'); hl('pelH', SPH, 'glutes');
      const bodyAPI = {
        grp, M,
        setEx(ex) {
          HL.forEach(h => { h.o.visible = !!(ex.focus && ex.focus[h.g]); });
          const z = ex.zone || [0, 1]; Q.torsoH.geometry = lathe(sub(ty.torso, z[0], z[1], .014)); Q.torsoH.userData.z = z;
        },
        setTone(i) { M.skin.color.setHex(TONES[i]); },
        update(j, w) {
          const S = j.S, P = j.P, zS = ty.zS, zH = ty.zH, tw = ty.tw, td = ty.td;
          const qT = new T.Quaternion().setFromAxisAngle(_z, -rad(j.t)), PV = V(P, 0), SV = V(S, 0);
          place(Q.torso, PV, SV, td, tw); place(Q.neck, SV, V(j.N, 0), .043, .043); place(Q.shLine, V(S, -zS), V(S, zS), .056, .056);
          Q.pelvis.position.copy(PV); Q.pelvis.quaternion.copy(qT); Q.chestCap.position.copy(SV); Q.chestCap.quaternion.copy(qT);
          const fw = [Math.cos(rad(j.t)), -Math.sin(rad(j.t))];
          if (ty.bust) [1, -1].forEach(s => { const c = Q['bust' + (s > 0 ? 'R' : 'L')], bp = [P[0] + (S[0] - P[0]) * .8 + fw[0] * .105, P[1] + (S[1] - P[1]) * .8 + fw[1] * .105]; c.position.set(bp[0], bp[1], s * .062); });
          const z = Q.torsoH.userData.z || [0, 1]; place(Q.torsoH, mix3(PV, SV, z[0]), mix3(PV, SV, z[1]), td * 1.1, tw * 1.1);
          Q.pelH.position.copy(PV); Q.pelH.quaternion.copy(qT); Q.pelH.scale.set(.15 * .85 * 1.12, .125 * 1.12, .15 * 1.32 * 1.12);
          const ang = -rad(j.ha); Q.head.position.set(j.Hc[0], j.Hc[1], 0); Q.head.quaternion.setFromAxisAngle(_z, ang);
          [1, -1].forEach(s => {
            const n = s > 0 ? 'R' : 'L', leg = j.legs[Math.min(j.legs.length - 1, s > 0 ? 0 : 1)] || j.legs[0];
            const sh = V(S, s * zS), el = V(j.E, s * (zS + .012)), wr = V(j.W, s * (zS + .018));
            Q['sho' + n].position.copy(sh); Q['shoH' + n].position.copy(sh); Q['shoH' + n].scale.setScalar(.063 * k * 1.3 + .005);
            place(Q['ua' + n], sh, el); place(Q['sl' + n], sh, mix3(sh, el, .58)); place(Q['fa' + n], el, wr); place(Q['uaH' + n], sh, el, 1.14, 1.14); place(Q['faH' + n], el, wr, 1.14, 1.14);
            Q['elb' + n].position.copy(el); Q['hand' + n].position.copy(wr);
            const hp = V(P, s * zH), kn = V(leg.K, s * zH), an = V(leg.A, s * zH), to = V(leg.T, s * zH);
            place(Q['th' + n], hp, kn); place(Q['sr' + n], hp, mix3(hp, kn, ty.shortsFrac)); place(Q['sh' + n], kn, an); place(Q['thH' + n], hp, kn, 1.14, 1.14); place(Q['shH' + n], kn, an, 1.14, 1.14);
            Q['knee' + n].position.copy(kn); Q['ank' + n].position.copy(an); place(Q['shoe' + n], an, to); Q['heel' + n].position.copy(an).add(new T.Vector3(-.012, -.008, 0)); Q['toe' + n].position.copy(to);
          });
          M.hl.opacity = .08 + .3 * w;
        }
      };
      return bodyAPI;
    };

    // props + implements (unchanged)
    let props = new T.Group(), bar = null, dbs = []; scene.add(props);
    const bmat = { plate: new T.MeshStandardMaterial({ color: 0x1b1f1d, roughness: .5, metalness: .6 }), steel: new T.MeshStandardMaterial({ color: 0xc9cfcc, roughness: .25, metalness: .9 }), bench: new T.MeshStandardMaterial({ color: 0x20302a, roughness: .7 }), rack: new T.MeshStandardMaterial({ color: 0x2e3631, roughness: .4, metalness: .7 }) };
    const box = (w, h, d, mat, x, y, z) => { const m = mk(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; props.add(m); return m; };
    const setProps = ex => {
      scene.remove(props); props = new T.Group(); scene.add(props); bar = null; dbs = [];
      if (ex.props === 'bench') { box(1.35, .08, .3, bmat.bench, -.38, .38, 0); [-.9, .12].forEach(x => [-.1, .1].forEach(z => box(.05, .34, .05, bmat.rack, x, .17, z))); }
      if (ex.props === 'mat') box(2.6, .03, .8, bmat.bench, -.55, .015, 0);
      if (ex.props === 'pullup') { [-.7, .7].forEach(z => box(.06, 2.3, .06, bmat.rack, -.05, 1.15, z)); const b = mk(new T.CylinderGeometry(.022, .022, 1.5, 14), bmat.steel); b.rotation.x = Math.PI / 2; b.position.set(0, 2.2, 0); props.add(b); }
      if (ex.bar === 'barbell') {
        bar = new T.Group(); const sh = mk(new T.CylinderGeometry(.014, .014, 1.9, 12), bmat.steel); sh.rotation.x = Math.PI / 2; bar.add(sh);
        [-1, 1].forEach(s => [[.62, .22, .05], [.69, .18, .04]].forEach(([z, r, h]) => { const p = mk(new T.CylinderGeometry(r, r, h, 28), bmat.plate); p.rotation.x = Math.PI / 2; p.position.z = s * z; bar.add(p); }));
        props.add(bar);
      }
      if (ex.bar === 'db') [1, -1].forEach(s => {
        const g = new T.Group(), h = mk(new T.CylinderGeometry(.018, .018, .16, 10), bmat.steel); h.rotation.x = Math.PI / 2; g.add(h);
        [-1, 1].forEach(q => { const p = mk(new T.CylinderGeometry(.075, .075, .035, 20), bmat.plate); p.rotation.x = Math.PI / 2; p.position.z = q * .085; g.add(p); });
        props.add(g); dbs.push({ g, s });
      });
    };

    // labels: where the muscle works / what to watch
    const ANCH = {
      quads: j => mid(j.P, j.legs[0].K), glutes: j => j.P, calves: j => mid(j.legs[0].K, j.legs[0].A), knees: j => j.legs[0].K, ankles: j => j.legs[0].A,
      chest: j => lerp2(j.P, j.S, .82), core: j => lerp2(j.P, j.S, .35), lowerback: j => lerp2(j.P, j.S, .2), upperback: j => lerp2(j.P, j.S, .72), lats: j => lerp2(j.P, j.S, .6), spine: j => lerp2(j.P, j.S, .5),
      shoulders: j => j.S, biceps: j => mid(j.S, j.E), forearms: j => mid(j.E, j.W), elbows: j => j.E, wrists: j => j.W, neck: j => j.N
    };
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let labels = [], showLabels = true;
    const buildLabels = ex => {
      labelsEl.innerHTML = '<svg class="x3-lines"></svg>'; labels = [];
      const svg = labelsEl.firstChild, L = ex.labels || { works: [], watch: [] };
      [...L.works.map(w => ({ kind: 'works', a: w[0], t: w[1] })), ...L.watch.map(w => ({ kind: 'watch', a: w[0], t: w[1], s: w[2] }))].forEach(l => {
        const dot = document.createElement('i'), pill = document.createElement('div'), line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        dot.className = 'x3-dot ' + l.kind; pill.className = 'x3-pill ' + l.kind; line.setAttribute('class', 'x3-ln ' + l.kind);
        pill.innerHTML = `${esc(l.t)}${l.s ? `<small>${esc(l.s)}</small>` : ''}`;
        labelsEl.appendChild(dot); labelsEl.appendChild(pill); svg.appendChild(line); labels.push({ dot, pill, line, a: l.a, side: l.kind === 'works' ? 1 : -1 });
      });
    };
    // two clean columns (works = right, watch = left), spread vertically so labels never overlap
    const layoutLabels = (j, W, H) => {
      const pts = labels.map(l => { const a = ANCH[l.a](j); _p.set(a[0], a[1], 0).project(camera); return { l, x: (_p.x * .5 + .5) * W, y: (-_p.y * .5 + .5) * H }; });
      [1, -1].forEach(side => {
        const col = pts.filter(p => p.l.side === side).sort((a, b) => a.y - b.y); let last = -1e9;
        col.forEach(p => { p.ly = Math.max(p.y, last + 44); last = p.ly; });
        const over = (col.length ? col[col.length - 1].ly : 0) - (H - 30); if (over > 0) col.forEach(p => { p.ly -= over; });
        col.forEach(p => {
          const w = p.l.pill.offsetWidth || 90, px = side > 0 ? W - 12 - w : 12, ex2 = side > 0 ? px : px + w;
          p.l.dot.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
          p.l.pill.style.transform = `translate(${px}px,${(p.ly - 16).toFixed(1)}px)`;
          p.l.line.setAttribute('x1', p.x.toFixed(1)); p.l.line.setAttribute('y1', p.y.toFixed(1)); p.l.line.setAttribute('x2', ex2); p.l.line.setAttribute('y2', p.ly.toFixed(1));
        });
      });
    };
    const _p = new T.Vector3();

    // orbit camera
    const cam = { az: 28, el: 12, r: 3.6, t: [0, .9, 0], auto: true, drag: false, px: 0, py: 0 };
    const applyCam = () => {
      const az = rad(cam.az), el = rad(Math.max(-5, Math.min(85, cam.el)));
      camera.position.set(cam.t[0] + cam.r * Math.cos(el) * Math.sin(az), cam.t[1] + cam.r * Math.sin(el), cam.t[2] + cam.r * Math.cos(el) * Math.cos(az));
      camera.lookAt(cam.t[0], cam.t[1], cam.t[2]);
    };
    canvas.addEventListener('pointerdown', e => { cam.drag = true; cam.px = e.clientX; cam.py = e.clientY; canvas.setPointerCapture(e.pointerId); cam.auto = false; });
    canvas.addEventListener('pointermove', e => { if (!cam.drag) return; cam.az -= (e.clientX - cam.px) * .45; cam.el += (e.clientY - cam.py) * .35; cam.px = e.clientX; cam.py = e.clientY; });
    const end = () => { cam.drag = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.max(1.6, Math.min(7, cam.r * (1 + e.deltaY * .001))); }, { passive: false });
    const size = () => { const w = wrap.clientWidth || 600, h = wrap.clientHeight || 420; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(wrap); size();

    let ex = null, body = null, gender = 'm';
    const setBody = g => { gender = g; if (body) scene.remove(body.grp); body = buildBody(g); scene.add(body.grp); if (ex) body.setEx(ex); };
    setBody('m');
    return {
      kind: 'webgl', cam,
      setBody, setTone(i) { toneI = i; body.setTone(i); }, toggleLabels(on) { showLabels = on; labelsEl.style.display = on ? '' : 'none'; },
      setEx(e) { ex = e; setProps(e); body.setEx(e); buildLabels(e); Object.assign(cam, { t: e.cam.t.slice(), r: e.cam.r, az: e.cam.az ?? 28, el: 12 }); },
      draw(j, w, dt) {
        body.update(j, w);
        if (bar && j.bar) bar.position.set(j.bar[0], j.bar[1], 0);
        dbs.forEach(d => d.g.position.set(j.W[0], j.W[1], d.s * (.205 + .02)));
        if (cam.auto) cam.az += dt * 14;
        applyCam(); camera.updateMatrixWorld(); renderer.render(scene, camera);
        if (showLabels) layoutLabels(j, wrap.clientWidth, wrap.clientHeight);
      },
      preset(n) { cam.auto = false; const m = { side: [0, 8], front: [90, 8], angle: [32, 14], top: [20, 80] }[n]; if (m) { cam.az = m[0]; cam.el = m[1]; } },
      dispose() { if (ro) ro.disconnect(); renderer.dispose(); }
    };
  };

  // ---------- 2D fallback ----------
  const make2D = (canvas, wrap) => {
    const c = canvas.getContext('2d'); let ex = null; const cam = { auto: false };
    const size = () => { const r = devicePixelRatio || 1; canvas.width = (wrap.clientWidth || 600) * r; canvas.height = (wrap.clientHeight || 420) * r; };
    size(); if (window.ResizeObserver) new ResizeObserver(size).observe(wrap);
    return {
      kind: '2d', cam, setEx(e) { ex = e; }, preset() { }, setBody() { }, setTone() { }, toggleLabels() { }, 
      draw(j) {
        const W = canvas.width, H = canvas.height, sc = H / 2.5, ox = W / 2 - (ex.cam.t[0] || 0) * sc, oy = H * .9;
        const X = p => ox + p[0] * sc, Y = p => oy - p[1] * sc;
        c.clearRect(0, 0, W, H); c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = '#3a5516'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, oy); c.lineTo(W, oy); c.stroke();
        if (ex.props === 'pullup') { c.strokeStyle = '#c9cfcc'; c.beginPath(); c.moveTo(X([-.4, 2.2]), Y([0, 2.2])); c.lineTo(X([.4, 2.2]), Y([0, 2.2])); c.stroke(); }
        const line = (pts, col, wd) => { c.strokeStyle = col; c.lineWidth = wd * sc / 100; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(p), Y(p)) : c.moveTo(X(p), Y(p))); c.stroke(); };
        const leg = j.legs[0]; line([j.P, leg.K, leg.A, leg.T], '#dde6da', 11); line([j.P, j.S], '#dde6da', 26); line([j.S, j.E, j.W], '#c8ff2e', 8);
        if (j.legs[1]) line([j.P, j.legs[1].K, j.legs[1].A, j.legs[1].T], '#aab5a8', 11);
        c.fillStyle = '#dde6da'; c.beginPath(); c.arc(X(j.Hc), Y(j.Hc), .1 * sc, 0, 7); c.fill();
        if (j.bar) { c.strokeStyle = '#8f9894'; c.lineWidth = 5; c.beginPath(); c.arc(X(j.bar), Y(j.bar), .2 * sc, 0, 7); c.stroke(); }
      }, dispose() { }
    };
  };

  // ---------- modal UI ----------
  let ov, state;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const close = () => {
    if (!ov) return; cancelAnimationFrame(state && state.raf); if (state && state.r) state.r.dispose();
    ov.remove(); ov = null; state = null; document.body.classList.remove('x3-lock');
  };
  const open = async (name, opts = {}) => {
    close();
    let ex = find(name); const missing = !ex; if (!ex) ex = EX[0];
    ov = document.createElement('div'); ov.className = 'x3-ov';
    ov.innerHTML = `<div class="x3-box" role="dialog" aria-modal="true" aria-label="Exercise demo">
      <button class="x3-x" aria-label="Close">✕</button>
      <div class="x3-left">
        <div class="x3-stage" id="x3Stage"><canvas id="x3Canvas"></canvas><div class="x3-load" id="x3Load">Loading 3D…</div>
          <div class="x3-badge"><span id="x3Phase">Ready</span></div><div class="x3-labels" id="x3Labels"></div><div class="x3-hint">Drag to rotate · scroll to zoom</div></div>
        <div class="x3-ctl"><button id="x3Play" title="Play / pause">⏸</button>
          <input id="x3Scrub" type="range" min="0" max="1000" value="0" aria-label="Scrub">
          <select id="x3Speed" aria-label="Speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></div>
        <div class="x3-views"><button data-v="side">Side</button><button data-v="front">Front</button><button data-v="angle">3/4</button><button data-v="top">Top</button><button id="x3Auto" class="on">Auto-rotate</button></div>
        <div class="x3-views x3-body"><span class="seg"><button data-g="m">♂ Male</button><button data-g="f">♀ Female</button></span><span class="tones" aria-label="Skin tone"><button data-tone="0" style="background:#f1c9a8"></button><button data-tone="1" style="background:#d9a27d"></button><button data-tone="2" style="background:#8f5d3f"></button></span><button id="x3Lab" class="on">Labels</button></div>
      </div>
      <div class="x3-right" id="x3Info"></div></div>`;
    document.body.appendChild(ov); document.body.classList.add('x3-lock');
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.x3-x').onclick = close;
    const $ = s => ov.querySelector(s);
    state = { ex, u: 0, speed: 1, playing: true, last: performance.now(), raf: 0, r: null, gender: opts.gender === 'f' ? 'f' : 'm' };

    const info = () => {
      const e = state.ex;
      $('#x3Info').innerHTML = `${missing && !state.picked ? `<div class="x3-miss">No 3D demo for "${esc(name)}" yet — showing a similar one. Pick another below.</div>` : ''}
        <label class="x3-pick">Exercise<select id="x3Sel">${EX.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <h3>${esc(e.name)}</h3><div class="x3-chips"><span class="lv">${e.level}</span>${e.muscles.map(m => `<span>${esc(m)}</span>`).join('')}</div>
        <div class="x3-legend"><span><i class="w"></i>Muscle working</span><span><i class="c"></i>Watch your form</span></div>
        <h4>How to do it</h4><ol>${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <h4>Avoid</h4><ul>${e.mistakes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <div class="x3-tip"><b>Sets &amp; reps</b> ${esc(e.tip)}<br><b>Breathing</b> ${esc(e.breath)}</div>`;
      $('#x3Sel').onchange = ev => { state.picked = true; state.ex = EX.find(x => x.id === ev.target.value); state.r.setEx(state.ex); info(); };
    };

    const ok = await loadThree(); if (!ov) return;
    const canvas = $('#x3Canvas'), stage = $('#x3Stage');
    try { state.r = ok && window.THREE ? makeThree(canvas, stage, $('#x3Labels')) : make2D(canvas, stage); }
    catch (err) { state.r = make2D(canvas.cloneNode ? (canvas.replaceWith(canvas = canvas.cloneNode()), canvas) : canvas, stage); }
    state.r.setBody(state.gender); state.r.setEx(state.ex); info();
    const syncBody = () => { ov.querySelectorAll('[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === state.gender)); };
    syncBody();
    ov.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { state.gender = b.dataset.g; state.r.setBody(state.gender); state.r.setEx(state.ex); syncBody(); });
    ov.querySelectorAll('[data-tone]').forEach(b => b.onclick = () => state.r.setTone(+b.dataset.tone));
    $('#x3Lab').onclick = () => { const on = $('#x3Lab').classList.toggle('on'); state.r.toggleLabels(on); };
    $('#x3Load').style.display = 'none';
    if (state.r.kind === '2d') $('.x3-hint').textContent = '2D preview (3D unavailable offline)';

    $('#x3Play').onclick = () => { state.playing = !state.playing; $('#x3Play').textContent = state.playing ? '⏸' : '▶'; };
    $('#x3Scrub').oninput = e => { state.playing = false; $('#x3Play').textContent = '▶'; state.u = e.target.value / 1000; };
    $('#x3Speed').onchange = e => { state.speed = +e.target.value; };
    ov.querySelectorAll('.x3-views [data-v]').forEach(b => b.onclick = () => { state.r.preset(b.dataset.v); $('#x3Auto').classList.remove('on'); });
    $('#x3Auto').onclick = () => { state.r.cam.auto = !state.r.cam.auto; $('#x3Auto').classList.toggle('on', state.r.cam.auto); };
    addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); } });

    const tick = now => {
      if (!ov) return; const dt = Math.min((now - state.last) / 1000, .1); state.last = now;
      const e = state.ex;
      if (state.playing) { state.u = (state.u + dt * state.speed / (e.hold ? 6 : 4.2)) % 1; $('#x3Scrub').value = Math.round(state.u * 1000); }
      const w = wOf(state.u, e.hold), j = solve(e.pose(w));
      state.r.draw(j, w, dt); $('#x3Phase').textContent = phaseOf(state.u, e);
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  };

  const api = { open, find, list: () => EX.map(e => ({ id: e.id, name: e.name })), solve, EX };
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
