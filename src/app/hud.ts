/**
 * What stays on screen while the cat plays: the cat's name and today's catches, the name of the
 * scene as it starts (for the people in the room), a clock if wanted, the ring that fills while
 * a finger holds the corner, and a menu button that shows only when a mouse moves. It all drifts
 * a few pixels over the minutes so nothing sits still on a screen for hours.
 */
import { t } from './i18n';

export class Hud {
  el: HTMLElement;
  private name: HTMLElement;
  private count: HTMLElement;
  private titleEl: HTMLElement;
  private clock: HTMLElement;
  private ring: HTMLElement;
  private ringArc: SVGCircleElement;
  private menuBtn: HTMLButtonElement;
  private hint: HTMLElement;
  private titleTimer = 0;
  private mouseTimer = 0;
  private drift = 0;

  constructor(root: HTMLElement, onMenu: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-cat"><span class="hud-name"></span><span class="hud-count"><i class="heart"></i><b>0</b></span></div>
      <div class="hud-title"></div>
      <div class="hud-clock"></div>
      <div class="hud-hint"></div>
      <div class="hud-ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="track"/><circle cx="22" cy="22" r="18" class="arc"/></svg><span>☰</span></div>
      <button class="hud-menu" aria-label="Menu">☰</button>`;
    root.appendChild(this.el);
    this.name = this.el.querySelector('.hud-name')!;
    this.count = this.el.querySelector('.hud-count b')!;
    this.titleEl = this.el.querySelector('.hud-title')!;
    this.clock = this.el.querySelector('.hud-clock')!;
    this.ring = this.el.querySelector('.hud-ring')!;
    this.ringArc = this.el.querySelector('.hud-ring .arc')!;
    this.menuBtn = this.el.querySelector('.hud-menu')!;
    this.hint = this.el.querySelector('.hud-hint')!;
    this.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); onMenu(); });
    this.menuBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  show(on: boolean) {
    this.el.classList.toggle('on', on);
  }

  config(o: { name: string; showName: boolean; showTitle: boolean; showClock: boolean }) {
    this.name.textContent = o.name;
    this.el.classList.toggle('no-name', !o.showName);
    this.el.classList.toggle('no-title', !o.showTitle);
    this.el.classList.toggle('no-clock', !o.showClock);
  }

  setCount(n: number, bump = false) {
    this.count.textContent = String(n);
    if (bump) {
      this.count.parentElement!.classList.remove('bump');
      void (this.count.parentElement as HTMLElement).offsetWidth;
      this.count.parentElement!.classList.add('bump');
    }
  }

  title(text: string) {
    this.titleEl.textContent = text;
    this.titleEl.classList.add('on');
    clearTimeout(this.titleTimer);
    this.titleTimer = window.setTimeout(() => this.titleEl.classList.remove('on'), 4200);
  }

  /** Once at the start of play: how to get back to the menu. */
  showHint(mouse: boolean) {
    this.hint.textContent = mouse ? t('hintMouse') : t('hint');
    this.hint.classList.add('on');
    window.setTimeout(() => this.hint.classList.remove('on'), 6000);
  }

  mouseMoved() {
    this.menuBtn.classList.add('on');
    clearTimeout(this.mouseTimer);
    this.mouseTimer = window.setTimeout(() => this.menuBtn.classList.remove('on'), 2600);
  }

  hold(p: number) {
    this.ring.classList.toggle('on', p > 0);
    const L = 2 * Math.PI * 18;
    this.ringArc.style.strokeDasharray = `${L * Math.min(1, p)} ${L}`;
  }

  tick(dt: number, now: Date) {
    this.drift += dt;
    // A slow wander of a few pixels, so no label burns in.
    const dx = Math.round(Math.sin(this.drift / 97) * 6), dy = Math.round(Math.sin(this.drift / 131 + 1) * 4);
    this.el.style.setProperty('--dx', dx + 'px');
    this.el.style.setProperty('--dy', dy + 'px');
    this.clock.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  }
}
