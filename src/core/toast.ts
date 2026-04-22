/**
 * Toast notifikace – malý self-contained modul použitelný kdekoliv
 * (Options page, místnost, injektované skripty na xchat.cz).
 *
 * Vlastnosti:
 *   • Tři úrovně: success / error / warning (neonové barvy, viditelné na
 *     světlém i tmavém pozadí).
 *   • Štosují se vpravo dole, max 5 najednou – starší se posouvají ven.
 *   • Animace slide+fade při příchodu i odchodu (≈220 ms, svižné).
 *   • Auto-hide po `duration` ms (default 4000). `duration: 0` = sticky,
 *     zmizí až kliknutím na křížek nebo `actionLabel` tlačítko.
 *
 * Styly se injektují jako `<style>` jednou při prvním volání – není tedy
 * potřeba žádný SCSS import a toast funguje i v kontextu bez Vite bundle
 * (vanilla feature skripty).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export type ToastLevel = 'success' | 'error' | 'warning';

export interface ToastOptions {
  level?: ToastLevel;
  message: string;
  /**
   * ms. 0 = sticky (dokud nezavře uživatel).
   * Výchozí: 4000.
   */
  duration?: number;
  /** Volitelné akční tlačítko uvnitř toastu. Po kliku se toast zavře. */
  actionLabel?: string;
  onAction?: () => void;
}

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4000;
const ANIM_MS = 220;
const STYLE_ID = 'xct-toast-style';
const CONTAINER_ID = 'xct-toast-container';

let container: HTMLDivElement | null = null;
const active: HTMLDivElement[] = [];

const CSS = `
#${CONTAINER_ID} {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
  font: 13px/1.35 'Segoe UI', Tahoma, Verdana, Arial, sans-serif;
}
#${CONTAINER_ID} .xct-toast {
  pointer-events: auto;
  min-width: 220px;
  max-width: 360px;
  padding: 8px 10px 8px 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--xct-toast-fg, #1a1a1a);
  background: var(--xct-toast-bg, #eafff0);
  backdrop-filter: blur(6px);
  border-radius: 6px;
  border: 1px solid var(--xct-toast-color, #39ff14);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 4px 14px rgba(0, 0, 0, 0.18),
    0 0 10px var(--xct-toast-glow, rgba(57, 255, 20, 0.35));
  opacity: 0;
  transform: translate3d(24px, 0, 0) scale(0.98);
  transition:
    opacity ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
    transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
}
#${CONTAINER_ID} .xct-toast--in {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}
#${CONTAINER_ID} .xct-toast--out {
  opacity: 0;
  transform: translate3d(24px, 0, 0) scale(0.96);
}
#${CONTAINER_ID} .xct-toast--dismissable {
  cursor: pointer;
}
#${CONTAINER_ID} .xct-toast--dismissable .xct-toast__msg {
  /* text uvnitř auto-hide toastu nelze běžně označit – kliknutí zavře.
     U sticky toastů (bez --dismissable) se selekce chová normálně. */
  user-select: none;
}
#${CONTAINER_ID} .xct-toast--success {
  --xct-toast-color: #1f9d4f;
  --xct-toast-glow: rgba(57, 255, 20, 0.35);
  --xct-toast-bg: #eafff0;
  --xct-toast-fg: #0e3a1f;
}
#${CONTAINER_ID} .xct-toast--error {
  --xct-toast-color: #d6264a;
  --xct-toast-glow: rgba(255, 46, 99, 0.35);
  --xct-toast-bg: #ffecf0;
  --xct-toast-fg: #4a0b1d;
}
#${CONTAINER_ID} .xct-toast--warning {
  --xct-toast-color: #b88700;
  --xct-toast-glow: rgba(255, 214, 10, 0.4);
  --xct-toast-bg: #fff7d6;
  --xct-toast-fg: #4a3a00;
}
#${CONTAINER_ID} .xct-toast__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--xct-toast-color, #39ff14);
  box-shadow: 0 0 6px var(--xct-toast-color, #39ff14);
}
#${CONTAINER_ID} .xct-toast__msg {
  flex: 1;
  word-wrap: break-word;
  white-space: pre-wrap;
}
#${CONTAINER_ID} .xct-toast__action {
  background: transparent;
  color: var(--xct-toast-color, #39ff14);
  border: 1px solid var(--xct-toast-color, #39ff14);
  border-radius: 4px;
  padding: 2px 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.2;
  transition: background-color 120ms ease;
}
#${CONTAINER_ID} .xct-toast__action:hover {
  background: rgba(0, 0, 0, 0.06);
}
#${CONTAINER_ID} .xct-toast__close {
  flex-shrink: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.55);
  border: none;
  padding: 0 2px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  align-self: flex-start;
}
#${CONTAINER_ID} .xct-toast__close:hover {
  color: var(--xct-toast-color, #000);
}
`;

const injectStyle = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(s);
};

const ensureContainer = (): HTMLDivElement => {
  if (container && document.body.contains(container)) return container;
  injectStyle();
  const el = document.createElement('div');
  el.id = CONTAINER_ID;
  (document.body ?? document.documentElement).appendChild(el);
  container = el;
  return el;
};

const removeToast = (el: HTMLDivElement): void => {
  if (!el.isConnected) return;
  el.classList.remove('xct-toast--in');
  el.classList.add('xct-toast--out');
  const idx = active.indexOf(el);
  if (idx >= 0) active.splice(idx, 1);
  window.setTimeout(() => {
    el.remove();
  }, ANIM_MS);
};

export const showToast = (opts: ToastOptions): (() => void) => {
  const level: ToastLevel = opts.level ?? 'success';
  const duration = opts.duration ?? DEFAULT_DURATION;

  const host = ensureContainer();

  const el = document.createElement('div');
  el.className = `xct-toast xct-toast--${level}`;
  el.setAttribute('role', level === 'error' ? 'alert' : 'status');

  const dot = document.createElement('span');
  dot.className = 'xct-toast__dot';
  el.appendChild(dot);

  const msg = document.createElement('div');
  msg.className = 'xct-toast__msg';
  msg.textContent = opts.message;
  el.appendChild(msg);

  if (opts.actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xct-toast__action';
    btn.textContent = opts.actionLabel;
    btn.addEventListener('click', (e) => {
      // Zabránit tomu, aby kliknutí probublalo na toast a zavřelo ho znovu
      // (navíc by se akce provedla před odstraněním – semantika by seděla,
      // ale chceme uložení flow explicitní).
      e.stopPropagation();
      try {
        opts.onAction?.();
      } finally {
        removeToast(el);
      }
    });
    el.appendChild(btn);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'xct-toast__close';
  close.setAttribute('aria-label', 'Zavřít');
  close.textContent = '×';
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast(el);
  });
  el.appendChild(close);

  host.appendChild(el);
  active.push(el);

  // Nejstarší pryč, pokud překračujeme limit.
  while (active.length > MAX_VISIBLE) {
    const oldest = active[0];
    removeToast(oldest);
  }

  // Fade-in na další frame, aby tranzice chytla.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('xct-toast--in');
    });
  });

  let timer: number | null = null;
  if (duration > 0) {
    // Auto-hide toast je kliknutím kamkoliv zavřitelný. Sticky toasty
    // (duration === 0) tuto moc neí – uživatel může označit text a kopírovat,
    // k zavření slouží jen křížek.
    el.classList.add('xct-toast--dismissable');
    el.addEventListener('click', () => removeToast(el));
    timer = window.setTimeout(() => removeToast(el), duration);
  }

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    removeToast(el);
  };
};

export const toast = {
  success: (message: string, duration?: number) =>
    showToast({ level: 'success', message, duration }),
  error: (message: string, duration?: number) =>
    showToast({ level: 'error', message, duration }),
  warning: (message: string, duration?: number) =>
    showToast({ level: 'warning', message, duration }),
};
