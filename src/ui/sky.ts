/** 昼夜 / 季节 / 天气:天空、地面、夜色、雨雪花瓣。全部由 worldAt(t) 驱动,开销小(公式粒子,无对象)。 */
import { worldAt } from '../core/world.ts';
import type { Weather } from '../core/world.ts';
import { TAU } from './draw.ts';

type C = CanvasRenderingContext2D;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function hex(s: string): [number, number, number] {
  if (s[0] === 'r') {
    const m = s.match(/\d+/g)!;
    return [+m[0], +m[1], +m[2]];
  }
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixC(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${Math.round(mix(x[0], y[0], t))},${Math.round(mix(x[1], y[1], t))},${Math.round(mix(x[2], y[2], t))})`;
}
function h01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const SKY_TOP_DAY = '#cfe9ff';
const SKY_HOR_DAY = '#ffffff';
const SKY_TOP_NIGHT = '#243063';
const SKY_HOR_NIGHT = '#566aa8';
/** 春夏秋冬 地面颜色(白天) */
const GROUND = ['#e4f3d4', '#d3ebbd', '#f3e4bf', '#f3f7fc'];
const GROUND_FAR = ['#cfe8bd', '#bfe0a4', '#e6d2a2', '#e2eaf4'];
/** 树冠颜色(春 夏 秋 冬) */
export const CANOPY = ['#fff1f5', '#e9f7e1', '#fff0c8', '#f1f5fa'];

export class Env {
  season = 0;
  daylight = 1;
  night = 0;
  dayPhase = 0.2;
  weather: Weather = 'clear';
  rainA = 0;
  snowA = 0;
  cloudA = 0;
  /** 圣诞:强制冬夜 */
  xmas = false;

  update(t: number, dt: number, xmas: boolean, snap = false): void {
    this.xmas = xmas;
    const w = worldAt(t, xmas ? 3 : undefined);
    this.season = w.season;
    this.dayPhase = xmas ? 0.75 : w.dayPhase;
    const dl = xmas ? 0.1 : w.daylight;
    const a = snap ? 1 : 1 - Math.exp(-dt * 2);
    this.daylight += (dl - this.daylight) * a;
    this.night = 1 - this.daylight;
    this.weather = xmas ? 'snow' : w.weather;
    const tr = this.weather === 'rain' ? 1 : 0;
    const ts = this.weather === 'snow' ? 1 : 0;
    const tc = this.weather === 'cloudy' || tr || ts ? 1 : 0;
    const b = snap ? 1 : 1 - Math.exp(-dt * 0.8);
    this.rainA += (tr - this.rainA) * b;
    this.snowA += (ts - this.snowA) * b;
    this.cloudA += (tc - this.cloudA) * b;
  }

  /** 天空渐变 + 星 + 日月。horizon = 地平线 y */
  sky(c: C, w: number, h: number, horizon: number, time: number, reduced: boolean): void {
    const d = this.daylight;
    const warm = Math.max(0, 1 - Math.abs(d - 0.5) * 3.2) * (this.xmas ? 0 : 1) * (1 - this.cloudA * 0.5);
    let top: string = mixC(SKY_TOP_NIGHT, SKY_TOP_DAY, d);
    let hor: string = mixC(SKY_HOR_NIGHT, SKY_HOR_DAY, d);
    if (warm > 0.02) hor = mixC(hor, '#ffc89a', Math.min(1, warm * 0.85));
    if (this.xmas) top = mixC(top, '#1a2150', 0.5);
    const g = c.createLinearGradient(0, 0, 0, Math.max(60, horizon + 10));
    g.addColorStop(0, top);
    g.addColorStop(1, hor);
    c.fillStyle = g;
    c.fillRect(-12, -12, w + 24, h + 24);
    // 阴天压一层灰
    if (this.cloudA > 0.01) {
      c.fillStyle = `rgba(150,160,175,${0.2 * this.cloudA * (0.4 + 0.6 * d)})`;
      c.fillRect(-12, -12, w + 24, Math.max(60, horizon + 10));
    }
    // 星星
    if (this.night > 0.35) {
      const a = (this.night - 0.35) / 0.65;
      c.fillStyle = '#fff';
      const sky = Math.max(70, horizon);
      for (let i = 0; i < 38; i++) {
        const tw = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(time * (1.2 + h01(i) * 2) + i);
        c.globalAlpha = a * (0.35 + 0.65 * tw) * (1 - this.cloudA * 0.6);
        const r = 0.8 + h01(i + 9) * 1.2;
        c.fillRect(h01(i + 3) * w, h01(i + 5) * sky * 0.92, r, r);
      }
      c.globalAlpha = 1;
    }
    // 日 / 月:半圆轨迹,0..0.5 白天走太阳,0.5..1 夜里走月亮
    const sky = Math.max(70, horizon);
    const isSun = this.dayPhase < 0.5 && !this.xmas;
    const u = isSun ? this.dayPhase / 0.5 : ((this.xmas ? 0.62 : this.dayPhase) - 0.5) / 0.5;
    const bx = w * (0.1 + 0.8 * u);
    const by = sky * 0.82 - Math.sin(u * Math.PI) * sky * 0.6 + 6;
    const alpha = Math.min(1, Math.sin(u * Math.PI) * 3);
    if (alpha <= 0.02) return;
    c.save();
    c.globalAlpha = alpha * (1 - this.cloudA * 0.45);
    c.strokeStyle = '#111';
    c.lineWidth = 2.4;
    if (isSun) {
      const r = Math.min(24, 12 + w * 0.03);
      const rot = reduced ? 0 : time * 0.15;
      for (let i = 0; i < 10; i++) {
        const a = rot + (i / 10) * TAU;
        c.beginPath();
        c.moveTo(bx + Math.cos(a) * (r + 5), by + Math.sin(a) * (r + 5));
        c.lineTo(bx + Math.cos(a) * (r + 12), by + Math.sin(a) * (r + 12));
        c.stroke();
      }
      c.fillStyle = mixC('#fff7cc', '#ffcf8a', warm);
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
      c.stroke();
    } else {
      const r = Math.min(20, 10 + w * 0.026);
      c.fillStyle = '#fffbe8';
      c.beginPath();
      c.arc(bx, by, r, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(160,170,200,.45)';
      c.beginPath();
      c.arc(bx - r * 0.3, by - r * 0.15, r * 0.22, 0, TAU);
      c.arc(bx + r * 0.25, by + r * 0.3, r * 0.15, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  /** 地面 */
  ground(c: C, w: number, h: number, horizon: number): void {
    const y = Math.max(8, Math.min(h - 30, horizon));
    const g = c.createLinearGradient(0, y, 0, h);
    const n = this.night * 0.45;
    g.addColorStop(0, mixC(GROUND_FAR[this.season], '#7d8db8', n));
    g.addColorStop(0.35, mixC(GROUND[this.season], '#8e9cc4', n));
    g.addColorStop(1, mixC(GROUND[this.season], '#8e9cc4', n));
    c.fillStyle = g;
    c.fillRect(-12, y, w + 24, h - y + 12);
    c.strokeStyle = 'rgba(0,0,0,.55)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-12, y);
    c.lineTo(w + 12, y);
    c.stroke();
  }

  /** 夜色蒙层:multiply 压暗并偏蓝(整幅画面,含景点街) */
  nightVeil(c: C, w: number, h: number, extra = 0): void {
    const a = Math.min(0.92, this.night * 0.62 + extra);
    if (a < 0.02) return;
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = mixC('#ffffff', '#5f6fa6', a);
    c.fillRect(-12, -12, w + 24, h + 24);
    c.restore();
  }

  /** 雨 / 雪 / 春花瓣 / 秋叶:公式粒子 */
  weatherFx(c: C, w: number, h: number, time: number, reduced: boolean): void {
    if (reduced) return;
    const ls = this.season;
    if (this.rainA > 0.02) {
      c.strokeStyle = `rgba(90,120,170,${0.5 * this.rainA})`;
      c.lineWidth = 1.2;
      c.beginPath();
      const n = Math.round(46 * this.rainA) + 8;
      for (let i = 0; i < n; i++) {
        const ph = (time * (1.5 + h01(i) * 0.6) + h01(i + 40)) % 1;
        const x = ((h01(i + 3) * (w + 60) - ph * 30) + w + 60) % (w + 60) - 10;
        const y = ph * (h + 20) - 10;
        c.moveTo(x, y);
        c.lineTo(x - 3, y + 11);
      }
      c.stroke();
    }
    if (this.snowA > 0.02 || (ls === 3 && !this.xmas && this.snowA > 0)) {
      c.fillStyle = `rgba(255,255,255,${0.95 * this.snowA})`;
      const n = Math.round(54 * this.snowA) + 6;
      for (let i = 0; i < n; i++) {
        const sp = 0.1 + h01(i) * 0.12;
        const ph = (time * sp + h01(i + 40)) % 1;
        const x = h01(i + 3) * w + Math.sin(time * 0.9 + i) * 14;
        const y = ph * (h + 12) - 6;
        c.beginPath();
        c.arc(x, y, 1.4 + h01(i + 7) * 1.8, 0, TAU);
        c.fill();
      }
    }
    // 春:花瓣;秋:落叶(不在雨雪天)
    const calm = 1 - Math.max(this.rainA, this.snowA);
    if ((ls === 0 || ls === 2) && calm > 0.2) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const ph = (time * (0.05 + h01(i) * 0.05) + h01(i + 40)) % 1;
        const x = h01(i + 3) * w + Math.sin(time * 0.7 + i * 2) * 22 + ph * 40;
        const y = ph * (h * 0.9);
        const rot = time * (0.8 + h01(i)) + i;
        c.save();
        c.globalAlpha = Math.min(1, calm) * (0.85 - ph * 0.5);
        c.translate(x % (w + 20), y);
        c.rotate(rot);
        c.fillStyle = ls === 0 ? '#ffc4d4' : h01(i + 12) > 0.5 ? '#f0a53a' : '#d8742c';
        c.beginPath();
        c.ellipse(0, 0, ls === 0 ? 3.4 : 5, ls === 0 ? 2.2 : 3, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    }
  }
}
