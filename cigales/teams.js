// Les Cigales (CIRM, 22.10.2026): the ten bird teams, shared by the phone page and the big screen.
// The phone keeps its own random id (localStorage) so it counts once and is remembered; no names leave it.
window.CIGALES = {
  api: 'https://script.google.com/macros/s/AKfycbxR84v8EDB4bV5icuTFLuRPZn5g0fwYmQd9fm0vPKkOGERLzldZwkV0JTup3UxFX5g/exec',
  workshop: 'cigales-2026', token: 'eWeH9g5eRjYQ',
  teams: [
    ['flamant','Flamant rose','#ff7ab8','#ffb3d6','#2b1b22'],
    ['guepier',"Guêpier d'Europe",'#2fd6c4','#ffd24a','#7a3b12'],
    ['huppe','Huppe fasciée','#f2a65a','#1b1b1b','#3b2416'],
    ['goeland','Goéland leucophée','#e9eef2','#9aa7b3','#f2c230'],
    ['martinet','Martinet noir','#59606b','#2a2f36','#c9d3dc'],
    ['rollier',"Rollier d'Europe",'#3fb4ff','#2468d6','#a8743c'],
    ['bonelli','Aigle de Bonelli','#c9a27a','#6b4a2e','#f2c230'],
    ['crecerellette','Faucon crécerellette','#e2884a','#9aa7b3','#f2c230'],
    ['mesange','Mésange charbonnière','#ffd84a','#1b2a3a','#5a5f66'],
    ['hirondelle','Hirondelle rustique','#2a3f7a','#e2544e','#1b1b1b'],
  ],
  facts: {"flamant": "En Camargue, il se nourrit les pattes dans l'eau ; son rose vient de ce qu'il mange.", "guepier": "Il attrape guêpes et abeilles en plein vol, et creuse son nid dans les talus de sable.", "huppe": "Sa crête s'ouvre en éventail, et son « oup-oup-oup » résonne dans la garrigue.", "goeland": "Le goéland de Marseille : il niche sur les îles du Frioul et jusque sur les toits.", "martinet": "Il vit presque toujours en vol : il y mange et y dort, l'été au-dessus des toits.", "rollier": "Bleu turquoise, il revient chaque été d'Afrique pour nicher en Crau et en Camargue.", "bonelli": "L'un des rapaces les plus rares de France : quelques couples nichent dans les falaises de Provence.", "crecerellette": "Petit faucon venu d'Afrique, il passe l'été dans la plaine de la Crau.", "mesange": "La plus commune de nos mésanges : une cravate noire sur un ventre jaune.", "hirondelle": "Deux fois par an, elle traverse le Sahara, et revient souvent au même nid."},
  bird(body, wing, beak) {
    return '<svg viewBox="0 0 80 80" aria-hidden="true"><ellipse cx="38" cy="46" rx="24" ry="20" fill="'+body+'"/>'
      + '<circle cx="56" cy="30" r="13" fill="'+body+'"/><path d="M68 30 l10 3 -10 4z" fill="'+beak+'"/>'
      + '<path class="wing" d="M22 44 q14 -16 30 2 q-14 12 -30 -2z" fill="'+wing+'"/><circle cx="59" cy="27" r="3.4" fill="#0d1117"/>'
      + '<circle cx="60.2" cy="25.8" r="1.1" fill="#fff"/><path d="M14 48 l-10 -6 2 10z" fill="'+wing+'"/>'
      + '<path d="M32 65 v8 M44 65 v8" stroke="'+beak+'" stroke-width="3" stroke-linecap="round"/></svg>';
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
