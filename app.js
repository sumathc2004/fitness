const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// scroll progress + back-to-top
const prog = $('#prog'), toTop = $('#toTop');
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  prog.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
  toTop.classList.toggle('show', scrollY > 700);
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();
toTop.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

// reveal + counters
const count = el => {
  const n = +el.dataset.n, s = el.dataset.s || '', t0 = performance.now();
  const step = t => {
    const p = Math.min((t - t0) / 1400, 1);
    el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))).toLocaleString() + s;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.querySelectorAll('[data-n]').forEach(count);
  io.unobserve(e.target);
}), { threshold: .15 });
$$('.rv').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(el); });

// calculator
const calc = () => {
  const age = +$('#age').value, h = +$('#height').value, w = +$('#weight').value;
  if (!age || !h || !w) return;
  const bmi = w / ((h / 100) ** 2);
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy weight' : bmi < 30 ? 'Overweight' : 'Obese';
  const bmr = 10 * w + 6.25 * h - 5 * age + ($('#gender').value === 'm' ? 5 : -161);
  $('#bmi').textContent = bmi.toFixed(1);
  $('#cat').textContent = cat;
  $('#kcal').textContent = Math.round(bmr * +$('#activity').value + +$('#goal').value).toLocaleString();
  $('#prot').textContent = Math.round(w * 1.8);
  $('#water').textContent = (w * 0.035).toFixed(1);
};
$('#calc').addEventListener('input', calc); calc();

// plan buttons open the checkout (demo payments)
$$('[data-plan]').forEach(b => b.addEventListener('click', ev => {
  ev.preventDefault();
  SVDPay.open({ plan: b.dataset.plan, trial: b.dataset.plan === 'Free Trial' });
}));
if ($('#siteQr')) { SVDPay.qr($('#siteQr'), 190); $('#siteUpi').textContent = SVDPay.CFG.upi; }

// premium hover: magnetic buttons + cursor spotlight on cards (skipped on touch / reduced motion)
if (matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  $$('.btn').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + 'px');
      b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .28).toFixed(1) + 'px');
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
  });
  $$('.tile,.plan,.counter,.panel').forEach(c => {
    c.classList.add('spot');
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--sx', (e.clientX - r.left) + 'px'); c.style.setProperty('--sy', (e.clientY - r.top) + 'px');
    });
  });
}
