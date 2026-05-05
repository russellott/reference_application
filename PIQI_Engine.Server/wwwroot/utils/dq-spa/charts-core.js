import { clamp } from './runtime.js';

export function getCanvasContext(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(Math.round(rect.width || canvas.width || 300), 1);
  const height = Math.max(Math.round(rect.height || canvas.height || 150), 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: ctx, w: width, h: height };
}

export function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function drawCanvasBase(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#f8fbff');
  bg.addColorStop(0.55, '#eef5ff');
  bg.addColorStop(1, '#edf7ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.84, h * 0.14, 0, w * 0.84, h * 0.14, Math.max(w, h) * 0.54);
  glow.addColorStop(0, 'rgba(2, 132, 199, 0.16)');
  glow.addColorStop(1, 'rgba(2, 132, 199, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d1e2f2';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  ctx.stroke();
}

export function chartTone(score) {
  if (score === null || score === undefined) return { strong: '#64748b', soft: '#cbd5e1', fill: 'rgba(100, 116, 139, 0.18)' };
  if (score >= 70) return { strong: '#059669', soft: '#6ee7b7', fill: 'rgba(5, 150, 105, 0.16)' };
  if (score >= 40) return { strong: '#d97706', soft: '#fbbf24', fill: 'rgba(217, 119, 6, 0.16)' };
  return { strong: '#dc2626', soft: '#fca5a5', fill: 'rgba(220, 38, 38, 0.18)' };
}

export function normalizeAngle(angle) {
  let out = angle;
  while (out < 0) out += Math.PI * 2;
  while (out >= Math.PI * 2) out -= Math.PI * 2;
  return out;
}

export function drawSmoothLine(ctx, coords) {
  if (!coords.length) return;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
  }
}

export { clamp };