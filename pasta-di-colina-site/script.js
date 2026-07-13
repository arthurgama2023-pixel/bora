// Hero: alterna painel marca ⇄ oferta
const panels = document.querySelectorAll('.hero__panel');
const offerCards = document.querySelectorAll('.offer__card');
if (panels.length > 1) {
  let p = 0;
  const dur = [7000, 6500]; // marca, oferta (ms)
  const swap = () => {
    panels[p].classList.remove('is-active');
    p = (p + 1) % panels.length;
    panels[p].classList.add('is-active');
    // cards de promoção (desktop + versão mobile) acompanham só o painel de oferta
    offerCards.forEach(c => c.classList.toggle('is-active', panels[p].dataset.panel === 'offer'));
    setTimeout(swap, dur[p]);
  };
  setTimeout(swap, dur[0]);
}

// História dentro do painel marca — fábrica → mãos → forno → mesa (3s cada)
const stageEls = document.querySelectorAll('.story__stage');
if (stageEls.length) {
  let cur = 0;
  setInterval(() => {
    stageEls[cur].classList.remove('active');
    cur = (cur + 1) % stageEls.length;
    stageEls[cur].classList.add('active');
  }, 3000);
}

// Navbar muda ao rolar
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Menu mobile
const burger = document.getElementById('burger');
const links = document.querySelector('.nav__links');
burger.addEventListener('click', () => links.classList.toggle('open'));
links.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => links.classList.remove('open'))
);

// Reveal ao rolar
const reveals = document.querySelectorAll('.card, .sense, .moment, .ucard, .menu__col, .section__head');
reveals.forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
reveals.forEach(el => io.observe(el));
