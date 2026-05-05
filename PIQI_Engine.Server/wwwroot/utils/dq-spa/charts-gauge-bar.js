import { pct } from './runtime.js';
import { chartTone, clamp, drawCanvasBase, getCanvasContext, roundRect } from './charts-core.js';

export function drawGaugeChart(canvasId, score) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const setup = getCanvasContext(canvas);
  if (!setup) return;
  const ctx = setup.ctx;
  const w = setup.w;
  const h = setup.h;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fillStyle = '#0d1117';
  ctx.fill();
  const cx = w / 2;
  const cy = h * 0.78;
  const radius = Math.min(w * 0.36, h * 0.60);
  const trackW = 20;
  const startAngle = Math.PI * 1.10;
  const endAngle = Math.PI * 1.90;
  const totalAngle = endAngle - startAngle;
  [{ from: 0, to: 0.4, color: '#ef4444' }, { from: 0.4, to: 0.7, color: '#f59e0b' }, { from: 0.7, to: 1, color: '#10b981' }].forEach(function (zone) {
    ctx.beginPath();
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = trackW;
    ctx.globalAlpha = 0.6;
    ctx.arc(cx, cy, radius, startAngle + zone.from * totalAngle, startAngle + zone.to * totalAngle);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  if (score !== null && score !== undefined) {
    const angle = startAngle + clamp(score / 100, 0, 1) * totalAngle;
    const tone = chartTone(score);
    ctx.beginPath();
    ctx.strokeStyle = tone.strong;
    ctx.lineWidth = trackW;
    ctx.arc(cx, cy, radius, startAngle, angle);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (radius - trackW / 2 - 6), cy + Math.sin(angle) * (radius - trackW / 2 - 6));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = tone.strong;
    ctx.font = '700 38px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pct(score), cx, cy - radius * 0.28);
  } else {
    ctx.fillStyle = '#484f58';
    ctx.font = '700 28px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('—', cx, cy - radius * 0.28);
  }
  // Threshold tick labels at arc boundary points
  const labelRadius = radius + trackW + 14;
  [
    { pct: 0, label: '0' },
    { pct: 0.4, label: '40' },
    { pct: 0.7, label: '70' },
    { pct: 1.0, label: '100' }
  ].forEach(function (t) {
    const angle = startAngle + t.pct * totalAngle;
    const lx = cx + Math.cos(angle) * labelRadius;
    const ly = cy + Math.sin(angle) * labelRadius;
    ctx.fillStyle = '#8b949e';
    ctx.font = '600 11px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, lx, ly);
  });
  // Bottom legend row: Critical / Caution / Good
  const zones = [
    { label: 'Critical', color: '#ef4444' },
    { label: 'Caution', color: '#f59e0b' },
    { label: 'Good', color: '#10b981' }
  ];
  const legRowY = h - 14;
  const legTotalW = zones.reduce(function (sum, z) { return sum + ctx.measureText(z.label).width + 18; }, 0);
  let legX = (w - legTotalW) / 2;
  ctx.font = '600 11px Aptos, Segoe UI, sans-serif';
  zones.forEach(function (z) {
    ctx.beginPath();
    ctx.arc(legX + 5, legRowY - 4, 5, 0, Math.PI * 2);
    ctx.fillStyle = z.color;
    ctx.fill();
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'left';
    ctx.fillText(z.label, legX + 14, legRowY);
    legX += ctx.measureText(z.label).width + 28;
  });
  ctx.textAlign = 'left';
}

export function drawBarChart(canvasId, bars) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const setup = getCanvasContext(canvas);
  if (!setup) return;
  const ctx = setup.ctx;
  const w = setup.w;
  const h = setup.h;
  drawCanvasBase(ctx, w, h);
  if (!bars.length) {
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('No class details available.', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }

  const left = 96;
  const right = 28;
  const top = 18;
  const bottom = 24;
  const plotW = w - left - right;
  const rowH = (h - top - bottom) / bars.length;
  bars.forEach(function (bar, index) {
    const y = top + index * rowH + 4;
    const width = (clamp(bar.val || 0, 0, 100) / 100) * plotW;
    const tone = chartTone(bar.val);
    ctx.fillStyle = '#334155';
    ctx.font = '600 12px Segoe UI';
    ctx.fillText(bar.name, 12, y + 16);
    roundRect(ctx, left, y, plotW, rowH - 10, 10);
    ctx.fillStyle = '#e7eef7';
    ctx.fill();
    roundRect(ctx, left, y, Math.max(width, 8), rowH - 10, 10);
    const barGradient = ctx.createLinearGradient(left, y, left + Math.max(width, 1), y);
    barGradient.addColorStop(0, tone.strong);
    barGradient.addColorStop(1, tone.soft);
    ctx.fillStyle = barGradient;
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 12px Segoe UI';
    ctx.fillText(pct(bar.val), Math.min(left + width + 8, w - right - 32), y + 16);
  });
}