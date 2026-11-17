// Restrained motion with the "motion" library (https://motion.dev).
//  1. One entrance on page load: the hero text rises in, one line after the other.
//  2. Lists (cards, products, reasons) rise in once, when they scroll into view.
// Nothing moves for visitors who prefer reduced motion, and without JavaScript everything is simply visible.
import { animate, stagger } from "motion";

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const ease = [0.22, 0.61, 0.36, 1]; // quick start, soft stop
  const rise = (items, { duration, gap, distance }) => {
    const run = animate(items, { opacity: [0, 1], y: [distance, 0] }, { duration, delay: stagger(gap), ease });
    run.then(() => items.forEach((el) => { el.style.opacity = ""; el.style.transform = ""; }));
  };

  const hero = [...document.querySelectorAll("[data-hero] > *")];
  if (hero.length) rise(hero, { duration: 0.7, gap: 0.09, distance: 18 });

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      seen.unobserve(entry.target);
      rise([...entry.target.children], { duration: 0.55, gap: 0.07, distance: 14 });
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  document.querySelectorAll("[data-reveal]").forEach((group) => {
    if (group.getBoundingClientRect().top < innerHeight) return; // already on screen: leave it alone
    [...group.children].forEach((el) => { el.style.opacity = "0"; });
    seen.observe(group);
  });
}
