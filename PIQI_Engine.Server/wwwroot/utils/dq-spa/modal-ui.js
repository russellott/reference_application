import { esc } from './runtime.js';

export function openModal(config) {
  const root = document.getElementById('modal-root');
  const bodyHtml = config.bodyHtml || '';
  const actionsHtml = config.actions && config.actions.length
    ? '<div class="modal-actions" style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">' +
      config.actions.map(function (action) {
        return '<button class="btn ' + (action.className || 'primary') + '" data-action="' + esc(action.label) + '">' + esc(action.label) + '</button>';
      }).join('') +
      '</div>'
    : '';

  root.innerHTML = '' +
    '<div class="modal-overlay" id="shared-modal-overlay">' +
    '  <div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(config.title) + '">' +
    '    <div class="modal-head">' +
    '      <div>' +
    '        <div><strong>' + esc(config.icon || '') + ' ' + esc(config.title) + '</strong></div>' +
    '        <div class="modal-meta">' + esc(config.subtitle || '') + '</div>' +
    '      </div>' +
    '      <button class="btn secondary" data-close-modal>Close</button>' +
    '    </div>' +
    '    <div class="modal-body">' + bodyHtml + actionsHtml + '</div>' +
    '  </div>' +
    '</div>';

  function close() {
    root.innerHTML = '';
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape') close();
  }

  root.querySelector('[data-close-modal]').addEventListener('click', close);
  root.querySelector('#shared-modal-overlay').addEventListener('click', function (e) {
    if (e.target.id === 'shared-modal-overlay') close();
  });

  if (config.actions && config.actions.length) {
    config.actions.forEach(function (action) {
      const btn = root.querySelector('[data-action="' + action.label + '"]');
      if (btn) {
        btn.addEventListener('click', function () {
          close();
          if (typeof action.onclick === 'function') action.onclick();
        });
      }
    });
  }

  document.addEventListener('keydown', onEsc);
}

export function modalStatRows(rows) {
  return rows.map(function (row) {
    return '<div class="stat-row"><span>' + esc(row.label) + '</span><strong>' + esc(row.value) + '</strong></div>';
  }).join('');
}

export function modalSection(title, html) {
  return '<section class="card"><h4 style="margin:0 0 8px">' + esc(title) + '</h4>' + html + '</section>';
}

export function modalTable(headers, rows) {
  const head = headers.map(function (header) {
    return '<th>' + esc(header) + '</th>';
  }).join('');
  const body = rows.map(function (row) {
    return '<tr>' + row.map(function (cell) {
      return '<td>' + esc(cell) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="table-wrap"><table class="table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

export function showToastSuccess(sourceLabel) {
  const host = document.getElementById('toast-host');
  host.innerHTML = '' +
    '<div class="toast" id="submit-toast">' +
    '  <div><strong>✓ Submission processed</strong></div>' +
    '  <div>Source <strong>' + esc(sourceLabel) + '</strong> stored in memory layer.</div>' +
    '  <div class="toast-actions"><button class="btn secondary" id="toast-dismiss">Dismiss</button></div>' +
    '</div>';
  document.getElementById('toast-dismiss').addEventListener('click', function () {
    host.innerHTML = '';
  });
}