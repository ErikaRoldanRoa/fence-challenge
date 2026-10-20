// Les Cigales (CIRM, 22.10.2026): the ten bird teams, shared by the phone page and the big screen.
// The phone keeps its own random id (localStorage) so it counts once and is remembered; no names leave it.
window.CIGALES = {
  api: 'https://script.google.com/macros/s/AKfycbxR84v8EDB4bV5icuTFLuRPZn5g0fwYmQd9fm0vPKkOGERLzldZwkV0JTup3UxFX5g/exec',
  workshop: 'cigales-2026', token: 'eWeH9g5eRjYQ',
  teams: [["f", "Pentomino F", "#ff4fd8", "[[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]]", "F"], ["i", "Pentomino I", "#7ff2ff", "[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]", "I"], ["l", "Pentomino L", "#6dff7a", "[[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]]", "L"], ["n", "Pentomino N", "#ffd24a", "[[1, 0], [1, 1], [1, 2], [0, 2], [0, 3]]", "N"], ["p", "Pentomino P", "#ff8a3d", "[[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]", "P"], ["t", "Pentomino T", "#a78bfa", "[[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]", "T"], ["u", "Pentomino U", "#3fb4ff", "[[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]]", "U"], ["v", "Pentomino V", "#ff6b6b", "[[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]", "V"], ["w", "Pentomino W", "#2fd6c4", "[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]", "W"], ["x", "Pentomino X", "#f472b6", "[[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]", "X"], ["y", "Pentomino Y", "#c3f53c", "[[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]]", "Y"], ["z", "Pentomino Z", "#fb923c", "[[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]]", "Z"]],
  facts: {},
  max: 5,                       // a pentomino has five squares: five phones a team, one square each
  ends: Date.parse('2026-10-22T19:30:00+02:00'),   // the contest ends on Thursday at 19:30, Zurich time (Erika, 20.10); the server refuses records from then on
  over() { return Date.now() >= this.ends; },
  // The questionnaire of the contest (retours/, the adapted LES): its event id, and the moment from which these pages offer it: the workshop day, Thursday morning.
  // Set `from` earlier or later here; nothing else changes. The public group (cirm) is never offered it.
  feedback: { event: '2026-10-22-cirm-cigales-enchivas', from: Date.parse('2026-10-22T08:00:00+02:00') },
  feedbackOpen() { return this.group !== 'cirm' && Date.now() >= this.feedback.from; },
  feedbackUrl() { return new URL('../retours/?e=' + this.feedback.event, location.href).href; },
  // The team's pentomino; LIT squares (one per phone, in order) are filled and smile, the others wait as an outline.
  // LIT left out: every square lit (the phone's own pentomino, the download).
  bird(color, cells, lit) {
    const c = JSON.parse(cells), S = 19, xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    const w = (Math.max(...xs) + 1) * S, h = (Math.max(...ys) + 1) * S, ox = (100 - w) / 2, oy = (100 - h) / 2;
    const n = lit == null ? c.length : lit;
    const sq = c.map(([x, y], i) => {
      const X = ox + x * S + 1, Y = oy + y * S + 1, on = i < n, cx = X + (S - 2) / 2, cy = Y + (S - 2) / 2;
      return '<rect x="' + X + '" y="' + Y + '" width="' + (S - 2) + '" height="' + (S - 2) + '" rx="3.5" fill="' + (on ? color : 'rgba(255,255,255,.04)')
        + '" stroke="' + (on ? 'rgba(13,17,23,.55)' : color) + '" stroke-width="1.5"' + (on ? '' : ' stroke-dasharray="3 2.5" opacity=".7"') + '/>'
        + (on ? '<circle cx="' + (cx - 3.3) + '" cy="' + (cy - 1.6) + '" r="2.1" fill="#0d1117"/><circle cx="' + (cx + 3.3) + '" cy="' + (cy - 1.6) + '" r="2.1" fill="#0d1117"/>'
          + '<path d="M' + (cx - 3.4) + ' ' + (cy + 2.6) + ' q3.4 3 6.8 0" stroke="#0d1117" stroke-width="1.5" fill="none" stroke-linecap="round"/>' : '');
    }).join('');
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><g class="wing">' + sq + '</g></svg>';
  },
  async counts() {
    const r = await fetch(this.api + '?action=getTeams&workshop=' + this.workshop, { cache: 'no-store' });
    return (await r.json()).teams || {};
  },
  // Joins (or switches) and retries until the server confirms this very team: with a whole class scanning at once,
  // a call can wait or fail (19.10 test: 4 of 30 lost without a retry). Only the latest choice is retried.
  async join(device, team) {
    this._want = team;
    for (let i = 0; i < 8 && this._want === team; i++) {
      try {
        const r = await fetch(this.api, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'joinTeam', workshop: this.workshop, token: this.token, device, team }) });
        const j = await r.json();
        if (j.status === 'full') return 'full';
        if (j.status === 'closed') return 'closed';
        if (j.status === 'ok' && j.team === team && !j.queued) return 'ok';
      } catch (e) {}
      await new Promise(res => setTimeout(res, 1500 + Math.random() * 2500 * (i + 1)));
    }
    return 'fail';
  },
};

// Two groups on the same pages (19.10): the Cigales (default) and everyone else at the CIRM (?g=cirm), each its own workshop and ranking.
(function (C) {
  const g = (new URLSearchParams(location.search).get('g') || '').toLowerCase();
  if (g === 'cirm') Object.assign(C, { group: 'cirm', workshop: 'cirm-2026', token: 'zfY7q4Jn8GXf', kicker: 'CIRM · Chaire Jean-Morlet', tag: 'Enchivas · CIRM',
    short: 'erikaroldanroa.github.io/cirm', base: 'https://erikaroldanroa.github.io/fence-challenge/cigales/?g=cirm&', query: '?g=cirm' });
  else Object.assign(C, { group: 'cigales', kicker: 'Les Cigales × La Performative · CIRM', tag: 'Enchivas · Les Cigales · CIRM',
    short: 'erikaroldanroa.github.io/c', base: 'https://erikaroldanroa.github.io/fence-challenge/cigales/?', query: '' });
})(window.CIGALES);
