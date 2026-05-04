import { activeBatchRunSubmissions, activeSessionSubmissions, esc, pct } from './runtime.js';
import { openModal } from './modal-ui.js';
import { getCanvasContext, normalizeAngle, roundRect } from './charts-core.js';

function getClassBreakdownByStatus(status) {
  const scoped = window.MOCK_DATA_LAYER.previewCorrelation && window.MOCK_DATA_LAYER.activeBatchRunId ? activeBatchRunSubmissions() : activeSessionSubmissions();
  const classMap = {};
  scoped.forEach(function (submission) {
    (submission.classRows || []).forEach(function (row) {
      classMap[row.dataClassName] = classMap[row.dataClassName] || { pass: 0, fail: 0, skip: 0, score: row.score };
      if (!row.denominator) classMap[row.dataClassName].skip += 1;
      else if (row.score >= 70) classMap[row.dataClassName].pass += 1;
      else classMap[row.dataClassName].fail += 1;
    });
  });
  return Object.keys(classMap).map(function (className) {
    return Object.assign({ className: className }, classMap[className]);
  }).filter(function (row) { return status === 'pass' ? row.pass > 0 : status === 'fail' ? row.fail > 0 : row.skip > 0; }).sort(function (a, b) {
    return (b.pass + b.fail + b.skip) - (a.pass + a.fail + a.skip);
  });
}

function openClassBreakdownModal(label, status, breakdown) {
  const color = status === 'pass' ? '#059669' : status === 'fail' ? '#ef4444' : '#d97706';
  const bodyHtml = !breakdown.length ? '<p class="section-sub" style="padding:8px 0">No classes recorded in this category yet.</p>' : '<div style="display:grid;gap:10px">' + breakdown.map(function (row) {
    const total = row.pass + row.fail + row.skip;
    const barPct = total ? Math.round((row[status] / total) * 100) : 0;
    const scoreColor = row.score === null ? '#94a3b8' : row.score >= 70 ? '#059669' : row.score >= 40 ? '#d97706' : '#ef4444';
    return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:13px 15px;background:#fff"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px"><strong style="font-size:0.95rem">' + esc(row.className) + '</strong><span style="color:' + scoreColor + ';font-weight:800;font-size:1.05rem">' + (row.score === null ? '—' : pct(row.score)) + '</span></div><div style="display:flex;gap:16px;font-size:0.82rem;color:#64748b;margin-bottom:9px"><span>Pass <strong style="color:#059669">' + row.pass + '</strong></span><span>Fail <strong style="color:#ef4444">' + row.fail + '</strong></span><span>Skip <strong style="color:#d97706">' + row.skip + '</strong></span></div><div style="height:7px;border-radius:999px;background:#e2e8f0;overflow:hidden"><div style="height:100%;width:' + barPct + '%;background:' + color + ';border-radius:999px"></div></div></div>';
  }).join('') + '</div>';
  openModal({ title: label + ' Classes', subtitle: breakdown.length + ' data class' + (breakdown.length !== 1 ? 'es' : ''), bodyHtml: bodyHtml });
}

export function drawDonutChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const setup = getCanvasContext(canvas);
  if (!setup) return;
  const ctx = setup.ctx;
  const w = setup.w;
  const h = setup.h;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  ctx.stroke();
  const total = (data.pass || 0) + (data.fail || 0) + (data.skip || 0);
  if (!total) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No scored class outcomes yet', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }

  const cx = w * 0.30;
  const cy = h * 0.50;
  const rOuter = Math.min(w * 0.26, h * 0.40);
  const rInner = rOuter * 0.52;
  const slices = [{ label: 'Pass', value: data.pass, color: '#10b981', status: 'pass' }, { label: 'Fail', value: data.fail, color: '#ef4444', status: 'fail' }, { label: 'Skip', value: data.skip, color: '#f59e0b', status: 'skip' }];
  const angles = [];
  let start = -Math.PI / 2;
  slices.forEach(function (slice) {
    const angle = slice.value ? (slice.value / total) * Math.PI * 2 : 0;
    angles.push({ label: slice.label, status: slice.status, startAngle: start, endAngle: start + angle });
    if (slice.value) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(start) * rInner, cy + Math.sin(start) * rInner);
      ctx.arc(cx, cy, rOuter, start + 0.028, start + angle - 0.028);
      ctx.arc(cx, cy, rInner, start + angle - 0.028, start + 0.028, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
    }
    start += angle;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = (data.pass / total) * 100 >= 70 ? '#059669' : (data.pass / total) * 100 >= 40 ? '#d97706' : '#dc2626';
  ctx.font = '700 24px Aptos, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round((data.pass / total) * 100) + '%', cx, cy + 5);
  ctx.textAlign = 'left';
  // Legend: Pass / Fail / Skip indicators with percentages
  const legendX = cx + rOuter + 24;
  const legendStartY = cy - 55;
  const legendRowH = 55;
  [
    { label: 'Pass', count: data.pass || 0, color: '#10b981' },
    { label: 'Fail', count: data.fail || 0, color: '#ef4444' },
    { label: 'Skip', count: data.skip || 0, color: '#f59e0b' }
  ].forEach(function (item, i) {
    const ly = legendStartY + i * legendRowH;
    const pctVal = total ? Math.round((item.count / total) * 100) : 0;
    ctx.beginPath();
    ctx.arc(legendX + 7, ly + 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = '600 13px Aptos, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 20, ly + 13);
    ctx.fillStyle = item.color;
    ctx.font = '700 20px Aptos, Segoe UI, sans-serif';
    ctx.fillText(pctVal + '%', legendX + 20, ly + 34);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 11px Aptos, Segoe UI, sans-serif';
    ctx.fillText('(' + item.count + ')', legendX + 20, ly + 48);
  });
  canvas.style.cursor = 'pointer';
  if (canvas.__donutClickHandler) canvas.removeEventListener('click', canvas.__donutClickHandler);
  canvas.__donutClickHandler = function (e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width - cx;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height - cy;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < rInner || dist > rOuter) return;
    const angle = normalizeAngle(Math.atan2(y, x));
    const clicked = angles.find(function (slice) {
      const startAngle = normalizeAngle(slice.startAngle);
      const endAngle = normalizeAngle(slice.endAngle);
      return startAngle <= endAngle ? angle >= startAngle && angle <= endAngle : angle >= startAngle || angle <= endAngle;
    });
    if (clicked) openClassBreakdownModal(clicked.label, clicked.status, getClassBreakdownByStatus(clicked.status));
  };
  canvas.addEventListener('click', canvas.__donutClickHandler);
}