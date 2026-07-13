// ===== Navbar sombra ao rolar =====
const nav = document.getElementById('nav');
function onScrollNav() { nav.classList.toggle('scrolled', window.scrollY > 20); }

// ===== Menu mobile =====
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => navLinks.classList.remove('open'))
);

// ===== Contadores animados =====
function animateCount(el) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const dur = 1600;
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = Math.round(eased * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

// ===== Reveal + contadores por posição de scroll (robusto, sem IO) =====
const reveals = [...document.querySelectorAll(
  '.hero__text, .hero__media, .stat, .sobre__media, .sobre__text, .section__head, .svc, .pillar, .benefit, .lixozero__media, .quote, .cta__inner'
)];
reveals.forEach(el => el.classList.add('reveal'));
const counters = [...document.querySelectorAll('[data-count]')];

function checkReveal() {
  const trigger = window.innerHeight * 0.9;
  reveals.forEach(el => {
    if (!el.classList.contains('in') && el.getBoundingClientRect().top < trigger) {
      el.classList.add('in');
    }
  });
  counters.forEach(el => {
    if (!el.dataset.done && el.getBoundingClientRect().top < trigger) {
      animateCount(el);
    }
  });
}

window.addEventListener('scroll', () => { onScrollNav(); checkReveal(); }, { passive: true });
window.addEventListener('resize', checkReveal);
window.addEventListener('load', checkReveal);
checkReveal();

// Rede de segurança: revela tudo após 2.5s mesmo sem scroll/paint
setTimeout(() => {
  reveals.forEach(el => el.classList.add('in'));
  counters.forEach(animateCount);
}, 2500);
