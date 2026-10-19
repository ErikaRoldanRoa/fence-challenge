// Les Cigales (CIRM, 22.10.2026): the ten bird teams, shared by the phone page and the big screen.
// The phone keeps its own random id (localStorage) so it counts once and is remembered; no names leave it.
window.CIGALES = {
  api: 'https://script.google.com/macros/s/AKfycbxR84v8EDB4bV5icuTFLuRPZn5g0fwYmQd9fm0vPKkOGERLzldZwkV0JTup3UxFX5g/exec',
  workshop: 'cigales-2026', token: 'eWeH9g5eRjYQ',
  teams: [["f", "Pentomino F", "#ff4fd8", "[[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]]", "F"], ["i", "Pentomino I", "#7ff2ff", "[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]", "I"], ["l", "Pentomino L", "#6dff7a", "[[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]]", "L"], ["n", "Pentomino N", "#ffd24a", "[[1, 0], [1, 1], [1, 2], [0, 2], [0, 3]]", "N"], ["p", "Pentomino P", "#ff8a3d", "[[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]", "P"], ["t", "Pentomino T", "#a78bfa", "[[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]]", "T"], ["u", "Pentomino U", "#3fb4ff", "[[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]]", "U"], ["v", "Pentomino V", "#ff6b6b", "[[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]", "V"], ["w", "Pentomino W", "#2fd6c4", "[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]]", "W"], ["x", "Pentomino X", "#f472b6", "[[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]", "X"], ["y", "Pentomino Y", "#c3f53c", "[[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]]", "Y"], ["z", "Pentomino Z", "#fb923c", "[[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]]", "Z"]],
  facts: {},
  bird(color, cells) {          // 19.10: the 12 pentominoes, a cartoon face on one square
    const c = JSON.parse(cells), S = 19, xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    const w = (Math.max(...xs) + 1) * S, h = (Math.max(...ys) + 1) * S, ox = (100 - w) / 2, oy = (100 - h) / 2;
    const sq = c.map(([x, y]) => '<rect x="' + (ox + x * S + 1) + '" y="' + (oy + y * S + 1) + '" width="' + (S - 2) + '" height="' + (S - 2) + '" rx="3.5" fill="' + color + '" stroke="rgba(13,17,23,.55)" stroke-width="1.5"/>').join('');
    const [fx, fy] = c[0], cx = ox + fx * S + S / 2, cy = oy + fy * S + S / 2;
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><g class="wing">' + sq + '</g>'
      + '<circle cx="' + (cx - 3.6) + '" cy="' + (cy - 1.5) + '" r="2.4" fill="#0d1117"/><circle cx="' + (cx + 3.6) + '" cy="' + (cy - 1.5) + '" r="2.4" fill="#0d1117"/>'
      + '<path d="M' + (cx - 3.5) + ' ' + (cy + 3) + ' q3.5 3 7 0" stroke="#0d1117" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
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
        if (j.status === 'ok' && j.team === team && !j.queued) return true;
      } catch (e) {}
      await new Promise(res => setTimeout(res, 1500 + Math.random() * 2500 * (i + 1)));
    }
    return false;
  },
};
