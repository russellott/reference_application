import { esc, pct } from './runtime.js';
import { modalSection, modalStatRows, openModal } from './modal-ui.js';
import { drawSmoothLine, getCanvasContext, roundRect } from './charts-core.js';

function openLinePointModal(point, index, total) {
  const score = point ? (point.score === null ? 0 : point.score) : 0;
  const status = score >= 70 ? 'pass' : score >= 40 ? 'warn' : 'fail';
  const statusLabel = status === 'pass' ? 'Passing' : status === 'warn' ? 'Caution' : 'Below Threshold';
  const statusColor = status === 'pass' ? '#059669' : status === 'warn' ? '#d97706' : '#dc2626';
  const submittedAt = point && point.t ? new Date(point.t).toLocaleString() : 'Unknown time';
  const topClasses = (point && point.classRows ? point.classRows : []).filter(function (row) { return row.score !== null; }).sort(function (a, b) { return (a.score || 0) - (b.score || 0); }).slice(0, 6);
  const classSection = topClasses.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Data Class</th><th>Score</th><th>Status</th></tr></thead><tbody>' + topClasses.map(function (row) {
    const cls = row.score >= 70 ? 'pass' : row.score >= 40 ? 'warn' : 'fail';
    return '<tr><td>' + esc(row.dataClassName) + '</td><td style="font-weight:700;color:' + (cls === 'pass' ? '#059669' : cls === 'warn' ? '#d97706' : '#ef4444') + '">' + pct(row.score) + '</td><td><span class="badge ' + cls + '">' + (cls === 'pass' ? 'Passing' : cls === 'warn' ? 'Watch' : 'Failing') + '</span></td></tr>';
  }).join('') + '</tbody></table></div>' : '<p class="section-sub">No class-level detail available for this submission.</p>';
  openModal({
    title: 'Submission ' + (index + 1) + ' of ' + total,
    subtitle: (point && point.source ? point.source : '—') + ' · ' + (point && point.provider ? point.provider : '—') + ' · ' + submittedAt,
    bodyHtml: '<div style="display:flex;align-items:center;gap:18px;margin-bottom:18px;padding:14px 16px;background:linear-gradient(135deg,#f8fbff,#eef5ff);border-radius:14px;border:1px solid #dbe9f6"><div style="font-size:3rem;font-weight:900;color:' + statusColor + ';letter-spacing:-0.04em;line-height:1">' + pct(score) + '</div><div><span class="badge ' + status + '" style="font-size:0.92rem;padding:5px 14px;display:inline-block;margin-bottom:6px">' + statusLabel + '</span><div style="font-size:0.88rem;color:#64748b">' + (score >= 70 ? '<span style="color:#059669;font-weight:700">✓ Meets threshold</span>' : '<span style="color:#dc2626;font-weight:700">' + (70 - score).toFixed(0) + ' pts needed to pass</span>') + '</div></div></div>' + modalSection('Submission detail', modalStatRows([{ label: 'Source', value: point && point.source ? point.source : '—' }, { label: 'Provider', value: point && point.provider ? point.provider : '—' }, { label: 'Submitted', value: submittedAt }, { label: 'Critical checks', value: String(point && point.criticalCount !== undefined ? point.criticalCount : '—') }, { label: 'Clean checks', value: String(point && point.cleanCount !== undefined ? point.cleanCount : '—') }])) + modalSection('Data class scores (lowest first)', classSection)
  });
}

export function drawLineChart(canvasId, points) {
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
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  ctx.stroke();
  if (!points.length) {
    ctx.fillStyle = '#8b949e';
    ctx.font = '14px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Submit a message or run a batch to see trend data', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }

  const values = points.map(function (point) { return point.score === null ? 0 : point.score; });
  const left = 52;
  const right = 20;
  const top = 48;
  const bottom = 64;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  for (let i = 0; i <= 5; i += 1) {
    const y = top + (i / 5) * plotH;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(100 - i * 20), left - 7, y + 4);
  }
  const y70 = top + ((100 - 70) / 100) * plotH;
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = 'rgba(16,185,129,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, y70);
  ctx.lineTo(w - right, y70);
  ctx.stroke();
  const y40 = top + ((100 - 40) / 100) * plotH;
  ctx.strokeStyle = 'rgba(239,68,68,0.55)';
  ctx.beginPath();
  ctx.moveTo(left, y40);
  ctx.lineTo(w - right, y40);
  ctx.stroke();
  ctx.setLineDash([]);
  const coords = values.map(function (value, index) {
    return { x: left + (values.length === 1 ? plotW / 2 : (index / (values.length - 1)) * plotW), y: top + ((100 - value) / 100) * plotH, v: value, pt: points[index] };
  });
  drawSmoothLine(ctx, coords);
  ctx.lineTo(coords[coords.length - 1].x, top + plotH);
  ctx.lineTo(coords[0].x, top + plotH);
  ctx.closePath();
  const area = ctx.createLinearGradient(0, top, 0, top + plotH);
  area.addColorStop(0, 'rgba(0,188,212,0.22)');
  area.addColorStop(1, 'rgba(0,188,212,0)');
  ctx.fillStyle = area;
  ctx.fill();
  drawSmoothLine(ctx, coords);
  const line = ctx.createLinearGradient(left, 0, w - right, 0);
  line.addColorStop(0, '#ef4444');
  line.addColorStop(0.4, '#f59e0b');
  line.addColorStop(1, '#10b981');
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.stroke();
  coords.forEach(function (pt, index) {
    const dot = pt.v >= 70 ? '#10b981' : pt.v >= 40 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
    if (index === coords.length - 1) {
      const pillX = Math.min(Math.max(pt.x - 28, left), w - right - 56);
      const pillY = Math.max(pt.y - 38, top + 2);
      roundRect(ctx, pillX, pillY, 56, 22, 11);
      ctx.fillStyle = dot;
      ctx.fill();
      ctx.fillStyle = '#0d1117';
      ctx.font = '700 11px Aptos, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pct(pt.v), pillX + 28, pillY + 15);
      ctx.textAlign = 'left';
    }
  });
  // X-axis submission index labels
  const xLabelY = top + plotH + 18;
  const xStep = Math.max(1, Math.ceil(coords.length / 10));
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px Aptos, Segoe UI, sans-serif';
  coords.forEach(function (pt, index) {
    if (index % xStep !== 0 && index !== coords.length - 1) return;
    ctx.textAlign = 'center';
    ctx.fillText('#' + (index + 1), pt.x, xLabelY);
  });
  ctx.textAlign = 'left';
  // Legend: Pass threshold + Fail threshold
  const legY = top + plotH + 42;
  const legendItems = [
    { label: 'Pass threshold (70%)', color: 'rgba(16,185,129,0.80)' },
    { label: 'Fail threshold (40%)', color: 'rgba(239,68,68,0.70)' }
  ];
  let legItemX = left;
  ctx.font = '11px Aptos, Segoe UI, sans-serif';
  legendItems.forEach(function (item) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(legItemX, legY);
    ctx.lineTo(legItemX + 22, legY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legItemX + 28, legY + 4);
    legItemX += 28 + ctx.measureText(item.label).width + 20;
  });
  canvas.style.cursor = 'pointer';
  if (canvas.__lineClickHandler) canvas.removeEventListener('click', canvas.__lineClickHandler);
  canvas.__lineClickHandler = function (e) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    let closest = null;
    let closestDist = Infinity;
    coords.forEach(function (coord, index) {
      const dist = Math.sqrt(Math.pow(canvasX - coord.x, 2) + Math.pow(canvasY - coord.y, 2));
      if (dist < closestDist) { closest = { coord: coord, index: index }; closestDist = dist; }
    });
    if (closest && closestDist <= 22) openLinePointModal(closest.coord.pt, closest.index, coords.length);
  };
  canvas.addEventListener('click', canvas.__lineClickHandler);
}