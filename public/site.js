(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const visible = window.scrollY > 140 || header.contains(document.activeElement);
    header.classList.toggle('is-visible', visible);
    header.inert = !visible;
    header.setAttribute('aria-hidden', String(!visible));
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('pageshow', scheduleUpdate);
  document.addEventListener('focusin', scheduleUpdate);
  document.addEventListener('focusout', scheduleUpdate);
  update();
})();
