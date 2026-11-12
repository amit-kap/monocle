// Start each piece of art when it scrolls into view.
(() => {
  const els = document.querySelectorAll(".art");
  if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("play")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("play"); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  els.forEach((el) => io.observe(el));
})();
