/* Cube lab: build a wall of polycubes in space and watch what it shuts in.
 *
 * Two steps, the 8 tetracubes and the 29 pentacubes, and two ways to play
 * each: explore (shut in as much as you can; with the pentacubes, also open
 * the walls of walls.js, spread them, cut them open, take them apart) and
 * wrap the room (a room is given; build a wall that shuts it in; rooms.js).
 *
 * The space is a grid of cells [x, y, z], y up. Every placed piece is a list
 * of cells; all cubes are drawn by one instanced mesh, the shut-in room by
 * another, and the picture is drawn again only when something changed. The
 * room is recomputed after every change (geometry.js). Emptiness leaks
 * through faces, edges and corners (26 neighbours, the default);
 * ?conn=6 lets it leak through faces only, for comparison.
 *
 * A piece of the tray is "in hand" until it is placed: a mouse shows where it
 * would go, a click or tap puts it there when it fits (red when it does not).
 * A placed piece is "selected" by a tap on it or on its chip: turn and tip
 * rotate it where it stands, the pad (in the tray's place), the arrow keys
 * and a drag move it, put back returns it to the tray; refused moves flash
 * red. A tap on empty floor lets go. Dragging elsewhere turns the view;
 * pinch or wheel zooms, never closer than the build allows.
 * Keys: arrows and PageUp/PageDown move, Enter places (and selects), Delete
 * puts back, R turns, T tips, Q/E turn the view, +/- zoom, [ and ] choose a
 * piece, Escape lets go, Ctrl+Z undoes. */
(function () {
  "use strict";
  var G = window.CubeGeometry, THREE = window.THREE, WALLS = window.CUBE_WALLS || [], ROOMS = window.CUBE_ROOMS || [];
  var t = function (k, v) { return window.i18n ? window.i18n.t(k, v) : k; };
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CONN = /[?&]conn=6\b/.test(location.search) ? 6 : 26;
  var MODES = { tetra: { n: 4, space: 9 }, penta: { n: 5, space: 12 } };

  // Piece hues skip the gold band, which belongs to the room.
  function hueOf(i, n) { return (80 + (i / n) * 315) % 360; }

  // ---------- state ----------
  var mode = "tetra", play = "explore";
  var boards = {}; // per step and way: { pieces: [{ shape, cells, hue }], hand, orient, sel, undo: [], space, room }
  var shapes = {}; // per step: the n-cubes, each with its 24-orientation list
  Object.keys(MODES).forEach(function (m) {
    var list = G.polycubes(MODES[m].n);
    shapes[m] = list.map(function (cells, i) {
      return { index: i, cells: cells, canon: G.canon(cells), orients: G.orientations(cells), hue: hueOf(i, list.length) };
    });
    ["explore", "wrap"].forEach(function (w) {
      boards[m + "/" + w] = { pieces: [], hand: null, orient: 0, sel: null, undo: [], space: MODES[m].space, room: null };
    });
  });
  function board() { return boards[mode + "/" + play]; }

  var spread = 0, cut = Infinity;
  var cursor = null; // where the piece in hand would go (mouse or keys)
  var busy = false; // a wall is being assembled, or a win is being shown
  var cast = 0, castGoal = 0; // 0 the wall, 1 the room alone
  var opened = null; // the wall of walls.js on screen, if any
  var solved = false;
  var foundTetra = false; // a room was shut in by hand with the tetracubes

  // Rooms already wrapped, remembered in this browser only.
  var solvedRooms = {};
  try { solvedRooms = JSON.parse(localStorage.getItem("fc-cube-rooms") || "{}") || {}; } catch (e) { solvedRooms = {}; }
  function rememberSolved(id) {
    solvedRooms[id] = true;
    try { localStorage.setItem("fc-cube-rooms", JSON.stringify(solvedRooms)); } catch (e) { /* private window */ }
  }
  // The ladder: the pentacube rooms from the smallest, then the tetracube
  // room, the hard one.
  var LADDER = ROOMS.filter(function (r) { return r.step === "penta"; }).concat(ROOMS.filter(function (r) { return r.step === "tetra"; }));

  // ---------- three.js scene ----------
  var canvas = $("space");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x1a1020, 0.95));
  var sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(0.6, 1, 0.35);
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0x9fd8ff, 0.25);
  fill.position.set(-0.7, 0.3, -0.6);
  scene.add(fill);
  var world = new THREE.Group();
  scene.add(world);

  var CUBE = 0.9;
  var boxGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  var edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.97, 0.97, 0.97));
  var shellGeo = new THREE.BoxGeometry(1.06, 1.06, 1.06);
  var cubeMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  // The room: white-gold light, a colour no piece wears.
  var roomMat = new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  var roomCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.2, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  var ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.45, depthWrite: false });
  var castMat = new THREE.MeshStandardMaterial({ color: 0xffd36e, emissive: 0x6b4a08, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 1 });
  var solidMat = new THREE.MeshStandardMaterial({ color: 0xffd36e, emissive: 0x6b4a08, roughness: 0.35, metalness: 0.15 });
  var targetMat = new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.28, depthWrite: false });
  var targetEdge = new THREE.LineBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.9 });
  // The selected piece keeps its colour, ringed in the cyan of "chosen".
  var selLine = new THREE.LineBasicMaterial({ color: 0x8ff4ff, transparent: true, opacity: 0.95, depthTest: false });
  var selGlow = new THREE.MeshBasicMaterial({ color: 0x00d1ff, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false });

  var cubes = null, room = null, roomCore = null, castMesh = null, target = null, ghost = null, outline = null, flash = null, burst = null, floor = null, grid = null;
  var instancePiece = [], instanceCell = [];
  var dummy = new THREE.Object3D();
  var colorTmp = new THREE.Color();

  function pieceColor(p, out) {
    var s = shapes[mode][p.shape];
    var hue = p.hue != null ? p.hue : s ? s.hue : 200;
    return out.setHSL(hue / 360, 0.78, 0.6);
  }
  function center() { var b = board(); return new THREE.Vector3(b.space / 2, 0, b.space / 2); }
  function cellPos(c, out) { var o = center(); return out.set(c[0] + 0.5 - o.x, c[1] + 0.5, c[2] + 0.5 - o.z); }

  function buildFloor() {
    if (floor) { world.remove(floor); world.remove(grid); }
    var s = board().space;
    floor = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: 0x131c28, transparent: true, opacity: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    world.add(floor);
    grid = new THREE.GridHelper(s, s, 0x3a4a62, 0x2a3850);
    grid.material.transparent = true;
    grid.position.y = 0.002;
    world.add(grid);
  }

  // ---------- drawing, on demand ----------
  var dirty = true;
  function render() { dirty = true; }

  var last = { volume: 0, regions: 0, enclosed: [], all: [] };
  function allCells(skip) {
    var out = [];
    board().pieces.forEach(function (p, i) { if (i !== skip) p.cells.forEach(function (c) { out.push(c); }); });
    return out;
  }

  // The wall that counts: every piece but a held one that overlaps.
  function wallCells() {
    var out = [];
    board().pieces.forEach(function (p) { if (!p.clash) p.cells.forEach(function (c) { out.push(c); }); });
    return out;
  }

  function measure() {
    last = G.enclosed(wallCells(), CONN);
    var r = board().room, was = solved;
    if (r) {
      var inside = {};
      last.all.forEach(function (c) { inside[G.key(c)] = true; });
      solved = r.cells.every(function (c) { return inside[G.key(c)]; });
      if (solved && !was) win(r);
    } else solved = false;
    document.body.toggleAttribute("data-solved", solved);
    // The why behind the tetracubes' limit opens once a room was found by hand.
    if (mode === "tetra" && play === "explore" && last.volume > 0 && !foundTetra) { foundTetra = true; syncChips(); }
    var v = $("volume-value"), before = +v.textContent;
    v.textContent = String(last.volume);
    document.body.toggleAttribute("data-shut", last.volume > 0);
    if (last.volume !== before && last.volume > 0) {
      var pill = $("volume");
      pill.classList.remove("pop");
      void pill.offsetWidth;
      pill.classList.add("pop");
    }
  }

  var midCache = null;
  function wallMid() {
    if (midCache) return midCache;
    var cells = allCells(), m = [0, 0, 0];
    if (!cells.length) return (midCache = [board().space / 2, 0, board().space / 2]);
    cells.forEach(function (c) { m[0] += c[0] + 0.5; m[1] += c[1] + 0.5; m[2] += c[2] + 0.5; });
    return (midCache = [m[0] / cells.length, m[1] / cells.length, m[2] / cells.length]);
  }

  function ease(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  // Where a piece is drawn: spread away from the middle, flown off in the cast.
  function pieceOffset(p, out) {
    out.set(0, 0, 0);
    var gone = ease(cast);
    if (!spread && !gone) return out;
    var cx = 0, cy = 0, cz = 0;
    p.cells.forEach(function (c) { cx += c[0] + 0.5; cy += c[1] + 0.5; cz += c[2] + 0.5; });
    var n = p.cells.length, mid = wallMid();
    var d = new THREE.Vector3(cx / n - mid[0], cy / n - mid[1], cz / n - mid[2]);
    out.addScaledVector(d, spread * 0.9);
    if (gone) out.addScaledVector(d.add(new THREE.Vector3(0, 0.5, 0)), gone * 2.2);
    return out;
  }

  function draw() {
    midCache = null;
    var b = board(), count = 0;
    b.pieces.forEach(function (p) { count += p.cells.length; });
    if (cubes) { world.remove(cubes); cubes.dispose(); }
    cubes = new THREE.InstancedMesh(boxGeo, cubeMat, Math.max(1, count));
    instancePiece = [];
    instanceCell = [];
    var i = 0, off = new THREE.Vector3(), pos = new THREE.Vector3();
    var scale = Math.max(0, 1 - ease(cast) * 1.15);
    b.pieces.forEach(function (p, pi) {
      pieceOffset(p, off);
      var col = pieceColor(p, colorTmp);
      p.cells.forEach(function (c) {
        cellPos(c, pos).add(off);
        dummy.position.copy(pos);
        // A held piece that overlaps is drawn as see-through red glass instead.
        dummy.scale.setScalar(c[1] >= cut || scale <= 0 || p.clash ? 0.0001 : scale);
        dummy.updateMatrix();
        cubes.setMatrixAt(i, dummy.matrix);
        cubes.setColorAt(i, col);
        instancePiece[i] = pi;
        instanceCell[i] = c;
        i++;
      });
    });
    cubes.count = count;
    // The first mesh had no colours; make three.js build the shader again.
    cubeMat.needsUpdate = true;
    cubes.instanceMatrix.needsUpdate = true;
    if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
    world.add(cubes);
    drawOutline();
    drawRoom();
    drawCast();
    drawTarget();
    drawGhost();
    syncTray();
    syncControls();
    render();
  }

  // The room to wrap: gold glass while open, solid gold once shut in.
  function drawTarget() {
    if (target) { world.remove(target); target = null; }
    var r = board().room;
    if (!r) return;
    target = new THREE.Group();
    r.cells.forEach(function (c) {
      if (c[1] >= cut) return;
      var m = new THREE.Mesh(boxGeo, solved ? solidMat : targetMat);
      cellPos(c, m.position);
      target.add(m);
      if (!solved) {
        var l = new THREE.LineSegments(edgeGeo, targetEdge);
        cellPos(c, l.position);
        l.scale.setScalar(0.93);
        target.add(l);
      }
    });
    world.add(target);
  }

  // The room as a solid: it sets from glow to gold as the wall leaves.
  function drawCast() {
    if (castMesh) { world.remove(castMesh); castMesh.dispose(); castMesh = null; }
    var k = ease(cast), cells = last.enclosed.filter(function (c) { return c[1] < cut; });
    if (!k || !cells.length || board().room) return;
    castMesh = new THREE.InstancedMesh(boxGeo, castMat, cells.length);
    var pos = new THREE.Vector3();
    cells.forEach(function (c, i) {
      cellPos(c, pos);
      dummy.position.copy(pos);
      dummy.scale.setScalar((0.62 + 0.38 * k) / CUBE * 0.96);
      dummy.updateMatrix();
      castMesh.setMatrixAt(i, dummy.matrix);
    });
    castMat.opacity = k;
    castMat.transparent = k < 1;
    castMat.needsUpdate = true;
    world.add(castMesh);
  }

  function drawOutline() {
    if (outline) { world.remove(outline); outline = null; }
    var b = board(), p = b.pieces[b.sel];
    if (!p || cast) return;
    outline = new THREE.Group();
    var off = pieceOffset(p, new THREE.Vector3());
    p.cells.forEach(function (c) {
      if (c[1] >= cut) return;
      var l = new THREE.LineSegments(edgeGeo, selLine);
      cellPos(c, l.position).add(off);
      l.renderOrder = 4;
      outline.add(l);
      var g = new THREE.Mesh(shellGeo, selGlow);
      g.position.copy(l.position);
      outline.add(g);
      if (p.clash) {
        var r = new THREE.Mesh(boxGeo, ghostBad);
        r.position.copy(l.position);
        outline.add(r);
      }
    });
    world.add(outline);
  }

  function drawRoom() {
    [room, roomCore].forEach(function (m) { if (m) { world.remove(m); m.dispose(); } });
    room = roomCore = null;
    var cells = last.enclosed.filter(function (c) { return c[1] < cut; });
    if (!cells.length || board().room) return;
    room = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), roomMat, cells.length);
    roomCore = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), roomCoreMat, cells.length);
    var pos = new THREE.Vector3();
    // The room stays put while the wall spreads away from it.
    cells.forEach(function (c, i) {
      cellPos(c, pos);
      dummy.position.copy(pos);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      room.setMatrixAt(i, dummy.matrix);
      roomCore.setMatrixAt(i, dummy.matrix);
    });
    // A big room glows as softly in total as a small one; it fades in the cast.
    var soft = Math.min(1, Math.sqrt(120 / cells.length)) * (1 - ease(cast) * 0.85);
    roomMat.opacity = 0.5 * soft;
    roomCoreMat.opacity = 0.2 * soft;
    room.renderOrder = 2;
    roomCore.renderOrder = 3;
    world.add(room);
    world.add(roomCore);
  }

  // ---------- fitting ----------
  function isPlaced(shapeIndex) { return board().pieces.some(function (p) { return p.shape === shapeIndex; }); }

  // Cells a piece may not take: other pieces, and the room to wrap.
  function occupied(skip) {
    var o = {}, r = board().room;
    allCells(skip).forEach(function (c) { o[G.key(c)] = true; });
    if (r) r.cells.forEach(function (c) { o[G.key(c)] = true; });
    return o;
  }
  function inSpace(c) { var s = board().space; return c[0] >= 0 && c[2] >= 0 && c[1] >= 0 && c[0] < s && c[2] < s && c[1] < s; }
  function fits(cells, skip) { var occ = occupied(skip); return cells.every(function (c) { return inSpace(c) && !occ[G.key(c)]; }); }

  function handCells() {
    var b = board();
    if (b.hand == null) return null;
    var s = shapes[mode][b.hand];
    return s.orients[b.orient % s.orients.length];
  }

  // Where the piece in hand goes when the cursor is cell `at`: the first of
  // its cells laid on `at` that fits, lowest cell first.
  function fitAt(at) {
    var shape = handCells();
    if (!shape || !at) return null;
    var anchors = shape.slice().sort(function (p, q) { return p[1] - q[1] || p[0] - q[0] || p[2] - q[2]; });
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i], cells = shape.map(function (c) { return [c[0] - a[0] + at[0], c[1] - a[1] + at[1], c[2] - a[2] + at[2]]; });
      if (fits(cells)) return cells;
    }
    return null;
  }

  // The piece in hand, drawn in its own colour, see-through; red if blocked.
  function ghostOf(cells, bad, hue) {
    var g = new THREE.Group();
    var mat = bad ? ghostBad : new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((hue == null ? 190 : hue) / 360, 0.85, 0.62), transparent: true, opacity: 0.5, depthWrite: false });
    cells.forEach(function (c) {
      var m = new THREE.Mesh(boxGeo, mat);
      cellPos(c, m.position);
      g.add(m);
    });
    return g;
  }

  var dragGhost = null; // cells shown while a selected piece is dragged
  function drawGhost() {
    if (ghost) { world.remove(ghost); ghost = null; }
    if (busy || cast) return;
    var b = board();
    if (dragGhost) {
      ghost = ghostOf(dragGhost.cells, !dragGhost.ok, b.pieces[b.sel] && pieceColor(b.pieces[b.sel], new THREE.Color()).getHSL({}).h * 360);
      world.add(ghost);
      return;
    }
    if (!cursor || b.hand == null) return;
    var cells = fitAt(cursor);
    ghost = cells ? ghostOf(cells, false, shapes[mode][b.hand].hue) : ghostOf([cursor], true);
    world.add(ghost);
  }

  // A refused place, move or turn: its cells in red, for a moment.
  function showConflict(cells) {
    if (flash) world.remove(flash);
    flash = ghostOf(cells.filter(inSpace), true);
    world.add(flash);
    var mine = flash;
    render();
    window.setTimeout(function () { if (flash === mine) { world.remove(flash); flash = null; render(); } }, 650);
  }

  // ---------- the camera ----------
  var view = { theta: Math.PI * 0.27, phi: 1.02, r: 20, target: new THREE.Vector3(0, 2, 0), minR: 4 };

  // The sphere holding what is built (or the floor when nothing is), with
  // the spread and the room.
  function contentSphere() {
    var b = board(), box = new THREE.Box3(), p = new THREE.Vector3(), off = new THREE.Vector3(), any = false;
    // In the cast, the room alone is what there is to see.
    if (castGoal && last.enclosed.length && !b.room) {
      last.enclosed.forEach(function (c) { box.expandByPoint(cellPos(c, p)); });
      box.expandByScalar(0.8);
      var only = box.getBoundingSphere(new THREE.Sphere());
      only.radius = Math.max(only.radius, 3);
      return only;
    }
    b.pieces.forEach(function (pc) {
      pieceOffset(pc, off);
      pc.cells.forEach(function (c) { box.expandByPoint(cellPos(c, p).add(off)); any = true; });
    });
    if (b.room) b.room.cells.forEach(function (c) { box.expandByPoint(cellPos(c, p)); any = true; });
    var s = b.space;
    if (!any) box.set(new THREE.Vector3(-s / 2, 0, -s / 2), new THREE.Vector3(s / 2, 1, s / 2));
    box.expandByScalar(0.8);
    // Never so close that a single piece fills the space.
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius = Math.max(sphere.radius, any ? 3.2 : 3);
    return sphere;
  }

  // Frame what is built: the camera keeps its direction and moves so the
  // content fills the space, the floor's middle never far off.
  function fit() {
    var sp = contentSphere();
    var vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    var fov = Math.min(vfov, hfov);
    view.r = sp.radius / Math.sin(fov / 2) * (board().pieces.length || board().room ? 1.02 : 0.82);
    view.minR = sp.radius + 1.5;
    view.target.copy(sp.center);
    placeCamera();
  }

  // Keep the camera still while editing; move it (smoothly) only when what
  // is built would leave the picture.
  var tween = null;
  function ensureVisible() {
    var sp = contentSphere(), v = new THREE.Vector3(), out = false;
    camera.updateMatrixWorld();
    var box = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
    var rr = sp.radius * 0.58;
    box.forEach(function (d) {
      v.set(sp.center.x + d[0] * rr, sp.center.y + d[1] * rr, sp.center.z + d[2] * rr).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.96) out = true;
    });
    if (!out) return;
    var from = { r: view.r, t: view.target.clone() };
    fit();
    var to = { r: view.r, t: view.target.clone() };
    if (reduceMotion) return;
    view.r = from.r;
    view.target.copy(from.t);
    placeCamera();
    tween = { start: performance.now(), from: from, to: to };
  }

  function placeCamera() {
    view.phi = Math.max(0.12, Math.min(Math.PI - 0.12, view.phi));
    view.r = Math.max(view.minR, Math.min(200, view.r));
    camera.position.set(
      view.target.x + view.r * Math.sin(view.phi) * Math.sin(view.theta),
      view.target.y + view.r * Math.cos(view.phi),
      view.target.z + view.r * Math.sin(view.phi) * Math.cos(view.theta)
    );
    camera.lookAt(view.target);
    // From below, the floor steps aside so the bottom of the wall shows.
    var under = camera.position.y < 0.05;
    if (grid) grid.material.opacity = under ? 0.12 : 1;
    if (floor) floor.visible = !under;
    render();
  }

  // The grid direction the viewer looks along (x or z, signed): the arrows
  // move along it and across it.
  function facing() {
    var fx = -Math.sin(view.theta), fz = -Math.cos(view.theta);
    return Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0, 0] : [0, 0, Math.sign(fz)];
  }
  function arrow(dir) {
    var f = facing(), r = [-f[2], 0, f[0]];
    if (dir === "up") return f;
    if (dir === "down") return [-f[0], 0, -f[2]];
    if (dir === "right") return r;
    if (dir === "left") return [-r[0], 0, -r[2]];
    if (dir === "rise") return [0, 1, 0];
    return [0, -1, 0];
  }

  // ---------- words ----------
  var lastSaid = null;
  function say(key, vars) { lastSaid = [key, vars]; $("status").textContent = t(key, vars); }
  function sayVolume() {
    if (!last.volume) return;
    if (last.regions > 1) say("cu.s.volParts", { v: last.volume, k: last.regions });
    else if (last.volume === 1) say("cu.s.vol1");
    else say("cu.s.vol", { v: last.volume });
  }

  // ---------- actions ----------
  function snapshot() {
    return board().pieces.map(function (p) { return { shape: p.shape, hue: p.hue, cells: p.cells.map(function (c) { return c.slice(); }) }; });
  }
  function remember() {
    var b = board();
    b.undo.push(snapshot());
    if (b.undo.length > 200) b.undo.shift();
  }

  function chooseHand(i) {
    var b = board();
    if (i == null || isPlaced(i)) b.hand = null;
    else if (b.hand !== i) { b.hand = i; b.orient = 0; }
    release();
    b.sel = null;
    draw();
    if (b.hand != null) say("cu.s.chosen", { n: i + 1 });
  }

  /* The selected piece is held: turns and moves always apply. If it then
   * overlaps another piece or leaves the space it shows red and does not
   * count; letting go of it there puts it back where it last fitted. */
  function where(cells) { return cells.map(G.key).sort().join(";"); }
  function hold(p) { p.fit = p.cells.map(function (c) { return c.slice(); }); p.clash = false; }

  // Let go of the held piece; true if it had to go back.
  function release() {
    var b = board(), p = b.sel != null ? b.pieces[b.sel] : null;
    if (!p) return false;
    var back = false;
    if (p.clash) {
      showConflict(p.cells);
      p.cells = p.fit;
      p.clash = false;
      back = true;
      say("cu.s.reverted");
    }
    if (b.selUndo && where(p.cells) === b.selUndo.at) {
      // Back where it started: nothing to undo.
      b.undo.pop();
    }
    b.selUndo = null;
    delete p.fit;
    if (back) measure();
    return back;
  }

  function select(pi) {
    var b = board();
    release();
    b.sel = pi != null && b.pieces[pi] ? pi : null;
    if (b.sel != null) hold(b.pieces[b.sel]);
    b.hand = null;
    cursor = null;
    draw();
    if (b.sel != null) say("cu.s.selected", { n: b.pieces[b.sel].shape >= 0 ? b.pieces[b.sel].shape + 1 : "·" });
  }

  function letGo() {
    var b = board();
    release();
    b.sel = null;
    b.hand = null;
    cursor = null;
    draw();
  }

  // Put the piece in hand at the cursor; by keys it stays selected.
  function place(keepSelected) {
    var cells = fitAt(cursor);
    if (!cells) {
      var shape = handCells();
      if (shape && cursor) showConflict(shape.map(function (c) { return [c[0] - shape[0][0] + cursor[0], c[1] - shape[0][1] + cursor[1], c[2] - shape[0][2] + cursor[2]]; }));
      say("cu.s.noRoom");
      return false;
    }
    remember();
    var b = board(), placedShape = b.hand;
    release();
    b.pieces.push({ shape: placedShape, cells: cells });
    b.hand = null;
    b.sel = keepSelected ? b.pieces.length - 1 : null;
    if (b.sel != null) hold(b.pieces[b.sel]);
    cursor = null;
    measure();
    draw();
    ensureVisible();
    if (b.pieces.length === shapes[mode].length) say("cu.s.allUsed", { n: shapes[mode].length });
    else say("cu.s.placed", { n: placedShape + 1 });
    sayVolume();
    return true;
  }

  function removeSelected() {
    var b = board();
    b.selUndo = null;
    if (b.sel == null || !b.pieces[b.sel]) { say("cu.s.selectFirst"); return; }
    remember();
    b.pieces.splice(b.sel, 1);
    b.sel = null;
    measure();
    draw();
    say("cu.s.removed");
  }

  // Apply a new pose to the held piece; it may overlap for now.
  function setHeld(cells, word) {
    var b = board(), p = b.pieces[b.sel];
    if (!p.fit) hold(p);
    if (!b.selUndo) {
      remember();
      b.selUndo = { at: where(p.cells) };
    }
    p.cells = cells;
    p.clash = !fits(cells, b.sel);
    if (!p.clash) p.fit = cells.map(function (c) { return c.slice(); });
    measure();
    draw();
    ensureVisible();
    if (p.clash) say("cu.s.overlap");
    else { say(word); sayVolume(); }
    return !p.clash;
  }

  function moveSelected(d) {
    var b = board(), p = b.pieces[b.sel];
    if (!p) return false;
    return setHeld(p.cells.map(function (c) { return [c[0] + d[0], c[1] + d[1], c[2] + d[2]]; }), "cu.s.moved");
  }

  // Turning: turn spins about the vertical (y), tip rolls about the
  // horizontal axis across the view; the two reach all 24 positions.
  function rot(axis) {
    if (axis === "y") return function (c) { return [c[2], c[1], -c[0]]; };
    var f = facing();
    return f[0] === 0 ? function (c) { return [c[0], -c[2], c[1]]; } : function (c) { return [c[1], -c[0], c[2]]; };
  }

  function turnBy(axis) {
    var b = board(), r = rot(axis);
    if (b.sel != null && b.pieces[b.sel]) {
      // Turn the placed piece about its middle cell, its lowest layer kept.
      var p = b.pieces[b.sel], mid = p.cells[Math.floor(p.cells.length / 2)];
      var turned = p.cells.map(function (c) { var q = r([c[0] - mid[0], c[1] - mid[1], c[2] - mid[2]]); return [q[0] + mid[0], q[1] + mid[1], q[2] + mid[2]]; });
      var lift = Math.min.apply(null, p.cells.map(function (c) { return c[1]; })) - Math.min.apply(null, turned.map(function (c) { return c[1]; }));
      turned = turned.map(function (c) { return [c[0], c[1] + lift, c[2]]; });
      setHeld(turned, "cu.s.turned");
      return;
    }
    var s = shapes[mode][b.hand];
    if (!s) { say("cu.s.pick"); return; }
    var sig = G.sig(s.orients[b.orient % s.orients.length].map(r));
    for (var i = 0; i < s.orients.length; i++) if (G.sig(s.orients[i]) === sig) { b.orient = i; break; }
    renderTrayPiece(b.hand);
    drawGhost();
    render();
    say("cu.s.turned");
  }

  function undo() {
    var b = board();
    if (!b.undo.length) { say("cu.s.nothingToUndo"); return; }
    b.pieces = b.undo.pop();
    b.sel = null;
    b.selUndo = null;
    if (b.hand != null && isPlaced(b.hand)) b.hand = null;
    measure();
    draw();
    say("cu.s.undone");
  }

  function clearAll() {
    var b = board();
    if (!b.pieces.length) return;
    remember();
    b.pieces = [];
    b.sel = null;
    opened = null;
    document.body.removeAttribute("data-opened");
    measure();
    draw();
    fit();
    syncChips();
    renderWalls();
    say("cu.s.cleared");
  }

  // ---------- the cast: the wall lifts away, the room stays ----------
  var castAnim = null;
  function setCast(goal, quiet) {
    castGoal = goal;
    var b = board();
    release();
    b.sel = null; b.hand = null; cursor = null;
    document.body.toggleAttribute("data-cast", goal === 1);
    $("cast").setAttribute("aria-pressed", goal ? "true" : "false");
    if (!quiet) say(goal ? "cu.s.cast" : "cu.s.uncast");
    syncChips();
    castAnim = { start: performance.now(), from: cast };
    if (reduceMotion) { cast = goal; castAnim = null; draw(); }
    render();
  }
  function toggleCast() {
    if (busy) { say("cu.s.busy"); return; }
    if (!castGoal && !last.volume) { say("cu.s.castEmpty"); return; }
    setCast(castGoal ? 0 : 1);
  }

  // ---------- a room wrapped: a burst of light, then a short cast ----------
  function win(r) {
    rememberSolved(r.id);
    say("cu.s.wrapped");
    renderRooms();
    if (reduceMotion) return;
    var pts = [], col = [], p = new THREE.Vector3(), mid = new THREE.Vector3();
    r.cells.forEach(function (c) { mid.add(cellPos(c, p)); });
    mid.divideScalar(r.cells.length);
    for (var i = 0; i < 260; i++) {
      var d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      pts.push(mid.x, mid.y, mid.z);
      col.push(d.x, d.y, d.z);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    burst = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.18, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    burst.userData = { start: performance.now(), dirs: col, mid: mid.clone() };
    world.add(burst);
    busy = true;
    document.body.setAttribute("data-busy", "");
    render();
  }

  // ---------- the walls of walls.js ----------
  function loadWall(w) {
    if (busy) { say("cu.s.busy"); return; }
    play = "explore";
    mode = "penta";
    refresh(true);
    var b = board();
    remember();
    var size = 0, height = 0;
    w.pieces.forEach(function (p) { p.forEach(function (c) { size = Math.max(size, c[0] + 1, c[2] + 1); height = Math.max(height, c[1] + 1); }); });
    var margin = 2;
    b.space = Math.max(MODES.penta.space, Math.max(size, height) + 2 * margin);
    var byCanon = {};
    shapes.penta.forEach(function (s) { byCanon[s.canon] = s.index; });
    var pieces = w.pieces.map(function (p, i) {
      var k = w.n === 5 ? byCanon[G.canon(p)] : undefined;
      return { shape: k == null ? -1 : k, cells: p.map(function (c) { return [c[0] + margin, c[1], c[2] + margin]; }), hue: k == null ? hueOf((i * 0.618034) % 1, 1) : null };
    });
    // Bottom first, so the lid lands last and the room lights at the end.
    var low = function (p) { return Math.min.apply(null, p.cells.map(function (c) { return c[1]; })); };
    pieces.sort(function (p, q) { return low(p) - low(q); });
    b.pieces = [];
    b.hand = null;
    b.sel = null;
    opened = w;
    document.body.setAttribute("data-opened", "");
    document.body.toggleAttribute("data-foreign", w.n !== 5);
    buildFloor();
    cut = Infinity;
    $("cut").max = String(b.space);
    $("cut").value = String(b.space);
    busy = true;
    document.body.setAttribute("data-busy", "");
    renderWalls();
    say("cu.s.loading");
    // Framed for the whole wall from the start.
    b.pieces = pieces;
    fit();
    b.pieces = [];
    var total = pieces.length, step = Math.max(1, Math.ceil(total / 40)), i = 0;
    function tick() {
      var upto = reduceMotion ? total : Math.min(total, i + step);
      for (; i < upto; i++) b.pieces.push(pieces[i]);
      measure();
      draw();
      if (i < total) window.setTimeout(tick, 70);
      else {
        busy = false;
        document.body.removeAttribute("data-busy");
        renderWalls();
        draw();
        syncChips();
        say("cu.s.paper");
        sayVolume();
      }
    }
    tick();
  }

  // ---------- tray ----------
  var tray = $("tray");

  // A small isometric drawing of a polycube, light from the top.
  function isoSvg(cells, hue) {
    var pts = function (x, y, z) { return [(x - z) * 0.866, -y + (x + z) * 0.5]; };
    var sorted = cells.slice().sort(function (p, q) { return (p[0] + p[2] + p[1]) - (q[0] + q[2] + q[1]); });
    var faces = [], minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sorted.forEach(function (c) {
      var x = c[0], y = c[1], z = c[2];
      var quad = function (a, light) {
        var p = a.map(function (v) { var q = pts(v[0], v[1], v[2]); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); return q[0].toFixed(3) + "," + q[1].toFixed(3); });
        faces.push('<polygon points="' + p.join(" ") + '" fill="hsl(' + hue.toFixed(0) + ',78%,' + light + '%)" stroke="#0d1117" stroke-width="0.06" stroke-linejoin="round"/>');
      };
      quad([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 72);
      quad([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 52);
      quad([[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]], 40);
    });
    var s = Math.max(maxX - minX, maxY - minY) + 0.3;
    var vb = [(minX + maxX) / 2 - s / 2, (minY + maxY) / 2 - s / 2, s, s].map(function (v) { return v.toFixed(3); }).join(" ");
    return '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false">' + faces.join("") + "</svg>";
  }

  function renderTrayPiece(i) {
    var btn = tray.querySelector('[data-shape="' + i + '"]');
    if (!btn) return;
    var s = shapes[mode][i], b = board();
    btn.innerHTML = isoSvg(i === b.hand ? s.orients[b.orient % s.orients.length] : s.cells, s.hue);
  }

  function buildTray() {
    tray.innerHTML = "";
    shapes[mode].forEach(function (s, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.setAttribute("data-shape", String(i));
      btn.addEventListener("click", function () {
        if (busy) { say("cu.s.busy"); return; }
        var b = board();
        if (isPlaced(i)) select(b.pieces.findIndex(function (p) { return p.shape === i; }));
        else if (b.hand === i) chooseHand(null);
        else chooseHand(i);
      });
      tray.appendChild(btn);
    });
    syncTray();
  }

  // One tab stop for the tray (the chosen piece, or the first); the arrows
  // walk along it.
  tray.addEventListener("keydown", function (e) {
    var chips = Array.prototype.slice.call(tray.querySelectorAll(".chip"));
    var at = chips.indexOf(document.activeElement);
    if (at < 0) return;
    var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    var next = chips[(at + d + chips.length) % chips.length];
    chips.forEach(function (c) { c.tabIndex = -1; });
    next.tabIndex = 0;
    next.focus();
  });

  // While the tray is dimmed, its pieces say why in their bubble.
  function dimReason() {
    var d = document.body;
    if (d.hasAttribute("data-busy")) return "cu.dim.busy";
    if (d.hasAttribute("data-cast")) return "cu.dim.cast";
    if (d.hasAttribute("data-foreign")) return "cu.dim.foreign";
    return null;
  }
  function syncTray() {
    var b = board(), any = false, dim = dimReason();
    tray.querySelectorAll(".chip").forEach(function (btn) {
      var i = +btn.getAttribute("data-shape"), used = isPlaced(i), cells = shapes[mode][i].cells;
      btn.classList.toggle("placed", used);
      btn.setAttribute("aria-pressed", i === b.hand ? "true" : "false");
      btn.setAttribute("aria-label", t(used ? "cu.pieceUsed" : "cu.piece", { n: i + 1, k: cells.length }));
      if (dim) { btn.setAttribute("aria-disabled", "true"); btn.setAttribute("data-lab-tip", t(dim)); }
      else { btn.removeAttribute("aria-disabled"); btn.removeAttribute("data-lab-tip"); }
      if (btn.tabIndex === 0) any = true;
      renderTrayPiece(i);
    });
    if (!any || b.hand != null) {
      var chips = tray.querySelectorAll(".chip"), pick = b.hand != null ? b.hand : 0;
      chips.forEach(function (c, k) { c.tabIndex = k === pick ? 0 : -1; });
    }
  }

  new MutationObserver(function () { syncTray(); }).observe(document.body, { attributes: true, attributeFilter: ["data-busy", "data-cast", "data-foreign"] });

  // Controls that need something chosen, or something to undo, wake up then.
  function syncControls() {
    var b = board(), has = b.sel != null && !!b.pieces[b.sel], any = has || b.hand != null;
    document.body.toggleAttribute("data-selected", has);
    $("delete").setAttribute("aria-disabled", has ? "false" : "true");
    $("turn").setAttribute("aria-disabled", any ? "false" : "true");
    $("tip").setAttribute("aria-disabled", any ? "false" : "true");
    $("undo").setAttribute("aria-disabled", b.undo.length ? "false" : "true");
  }

  // A small picture of a wall or room, drawn once by its own renderer.
  var thumbs = {}, thumbRenderer = null;
  function thumb(w) {
    if (thumbs[w.id]) return thumbs[w.id];
    if (!thumbRenderer) {
      thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.setSize(96, 96);
    }
    var sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xcfe9ff, 0x1a1020, 1));
    var l = new THREE.DirectionalLight(0xffffff, 0.7);
    l.position.set(0.6, 1, 0.35);
    sc.add(l);
    var n = 0, hi = [0, 0, 0];
    w.pieces.forEach(function (p) { n += p.length; p.forEach(function (c) { for (var a = 0; a < 3; a++) hi[a] = Math.max(hi[a], c[a] + 1); }); });
    var mesh = new THREE.InstancedMesh(boxGeo, cubeMat, n), i = 0, col = new THREE.Color();
    w.pieces.forEach(function (p, k) {
      if (w.gold) col.set(0xffd36e); else col.setHSL(hueOf((k * 0.618034) % 1, 1) / 360, 0.78, 0.6);
      p.forEach(function (c) {
        dummy.position.set(c[0] + 0.5 - hi[0] / 2, c[1] + 0.5 - hi[1] / 2, c[2] + 0.5 - hi[2] / 2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col);
        i++;
      });
    });
    sc.add(mesh);
    var size = Math.max(hi[0], hi[1], hi[2]) * 0.95;
    var cam = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, size * 12);
    cam.position.set(size * 2, size * 1.6, size * 2);
    cam.lookAt(0, 0, 0);
    thumbRenderer.render(sc, cam);
    mesh.dispose();
    return (thumbs[w.id] = thumbRenderer.domElement.toDataURL("image/png"));
  }

  function renderWalls() {
    var row = $("walls");
    row.innerHTML = "";
    WALLS.forEach(function (w, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctl wall";
      var on = opened === w;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("loading", on && busy);
      var name = t("cu.wall", { k: i + 1, p: w.pieces.length, n: w.n });
      btn.setAttribute("aria-label", name);
      btn.title = name;
      btn.innerHTML = '<img alt="" src="' + thumb(w) + '">';
      btn.addEventListener("click", function () { loadWall(w); });
      row.appendChild(btn);
    });
  }

  // ---------- steps and ways ----------
  function setMode(m) {
    if (m === mode && cubes) return;
    if (play === "wrap") {
      // In wrap, the step follows the room: the tetracubes have one room.
      var r = LADDER.filter(function (x) { return x.step === m; })[0];
      if (r) { setRoom(r); return; }
    }
    mode = m;
    refresh();
  }

  function setPlay(w) {
    if (w === play && cubes) return;
    play = w;
    if (w === "wrap" && !board().room) {
      // The ladder starts with the easy pentacube rooms.
      var first = LADDER.filter(function (r) { return !solvedRooms[r.id] && r.step === "penta"; })[0] || LADDER[0];
      mode = first.step;
      setRoom(first, true);
    }
    refresh();
  }

  function refresh(keepView) {
    Object.keys(boards).forEach(function (k) {
      boards[k].pieces.forEach(function (p) { if (p.clash && p.fit) p.cells = p.fit; p.clash = false; delete p.fit; });
      boards[k].selUndo = null;
    });
    document.body.setAttribute("data-mode", mode);
    document.body.setAttribute("data-play", play);
    document.title = t("cu.docTitle." + mode);
    $("mode-tetra").setAttribute("aria-pressed", mode === "tetra" ? "true" : "false");
    $("mode-penta").setAttribute("aria-pressed", mode === "penta" ? "true" : "false");
    $("play-explore").setAttribute("aria-pressed", play === "explore" ? "true" : "false");
    $("play-wrap").setAttribute("aria-pressed", play === "wrap" ? "true" : "false");
    var b = board();
    if (castGoal || cast) { castGoal = 0; cast = 0; castAnim = null; document.body.removeAttribute("data-cast"); $("cast").setAttribute("aria-pressed", "false"); }
    if (!(mode === "penta" && play === "explore")) { opened = null; document.body.removeAttribute("data-opened"); document.body.removeAttribute("data-foreign"); }
    solved = false;
    cursor = null;
    buildFloor();
    $("cut").max = String(b.space);
    $("cut").value = String(b.space);
    cut = Infinity;
    buildTray();
    measure();
    draw();
    if (!keepView) fit();
    syncPrint();
    renderRooms();
    renderWalls();
    syncChips();
  }

  // ---------- wrap the room ----------
  function setRoom(r, quiet) {
    if (mode !== r.step || play !== "wrap") { mode = r.step; play = "wrap"; }
    var b = board();
    if (b.room && b.room.id !== r.id && b.pieces.length) remember();
    var s = b.space, hi = [0, 1, 2].map(function (a) { return Math.max.apply(null, r.room.map(function (c) { return c[a]; })); });
    // In the middle of the floor, one layer up: the wall goes under it too.
    var off = [Math.floor((s - hi[0] - 1) / 2), 1, Math.floor((s - hi[2] - 1) / 2)];
    b.room = { id: r.id, def: r, cells: r.room.map(function (c) { return [c[0] + off[0], c[1] + off[1], c[2] + off[2]]; }) };
    b.pieces = [];
    b.sel = null;
    b.hand = null;
    if (!quiet) { refresh(); say("cu.s.room", { k: r.room.length }); }
  }

  // The ladder: a step back, the room on the floor, a step on, and a dot per
  // room (gold once wrapped; the last one, the hard tetracube room, a diamond).
  function renderRooms() {
    var row = $("rooms");
    row.innerHTML = "";
    var b = board();
    var at = b.room ? LADDER.findIndex(function (r) { return r.id === b.room.id; }) : -1;
    function stepBtn(to, key, path) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctl roomStep";
      btn.setAttribute("aria-label", t(key));
      btn.title = t(key);
      if (!LADDER[to]) btn.setAttribute("aria-disabled", "true");
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener("click", function () { if (busy) { say("cu.s.busy"); return; } if (LADDER[to]) setRoom(LADDER[to]); });
      return btn;
    }
    // From the hard room, "on" goes back to the start of the ladder.
    var next = at === LADDER.length - 1 ? 0 : at + 1;
    row.appendChild(stepBtn(at - 1, "cu.roomPrev", "M14.5 6 8.5 12l6 6"));
    if (at >= 0) {
      var r = LADDER[at], pic = document.createElement("span");
      pic.className = "roomPic" + (solvedRooms[r.id] ? " done" : "") + (r.step === "tetra" ? " boss" : "");
      pic.setAttribute("role", "img");
      pic.setAttribute("aria-label", t(r.room.length === 1 ? "cu.room1" : "cu.room", { k: r.room.length, i: at + 1, n: LADDER.length }) + (solvedRooms[r.id] ? " · " + t("cu.roomDone") : ""));
      pic.innerHTML = '<img alt="" src="' + thumb({ id: "room-" + r.id, pieces: [r.room], gold: true }) + '">';
      row.appendChild(pic);
    }
    row.appendChild(stepBtn(next, "cu.roomNext", "M9.5 6l6 6-6 6"));
    var dots = document.createElement("span");
    dots.className = "roomDots";
    dots.setAttribute("aria-hidden", "true");
    LADDER.forEach(function (x, k) {
      var d = document.createElement("i");
      d.className = (solvedRooms[x.id] ? "done " : "") + (k === at ? "here " : "") + (x.step === "tetra" ? "boss" : "");
      dots.appendChild(d);
    });
    row.appendChild(dots);
  }

  // One download per context: the pieces of the step, or the rooms.
  function syncPrint() {
    $("print").setAttribute("href", play === "wrap" ? "print/rooms.zip" : mode === "tetra" ? "print/tetracubes.zip" : "print/pentacubes.zip");
  }

  // ---------- the math chips: only those that explain what is on screen ----------
  function syncChips() {
    var b = board(), casting = !!castGoal, tetra = mode === "tetra", wrap = play === "wrap";
    var pentaWall = !!opened && opened.n === 5;
    var paperRule = CONN === 26;
    var show = {
      "m.room": true,
      "m.tetra": tetra && !wrap && foundTetra && paperRule,
      "m.turn": !tetra && !wrap && !opened,
      "m.wall": !casting && (tetra || wrap),
      "m.cast": casting,
      "m.wallinfo": !tetra && !wrap && !!opened,
      "m.bound": !tetra && !wrap && pentaWall && paperRule,
      "m.cover": !tetra && !wrap && pentaWall && paperRule,
      "m.roominfo": wrap && !!b.room
    };
    document.querySelectorAll(".math-chip[data-math]").forEach(function (chip) {
      var k = chip.getAttribute("data-math");
      chip.hidden = !show[k];
      ["title", "body", "src", "vars"].forEach(function (a) { chip.removeAttribute("data-math-" + a); });
    });
    var chip = function (k) { return document.querySelector('.math-chip[data-math="' + k + '"]'); };
    if (!paperRule) {
      ["m.room", "m.wall"].forEach(function (k) { chip(k).setAttribute("data-math-title", k + ".f.title"); chip(k).setAttribute("data-math-body", k + ".f.body"); });
    }
    chip("m.tetra").setAttribute("data-math-src", "m.ours");
    if (opened) {
      var c = chip("m.wallinfo"), cubesN = 0;
      opened.pieces.forEach(function (p) { cubesN += p.length; });
      c.setAttribute("data-math-vars", JSON.stringify({ k: WALLS.indexOf(opened) + 1, p: opened.pieces.length, n: opened.n, c: cubesN, v: G.enclosed([].concat.apply([], opened.pieces), CONN).volume }));
      var best = opened.id === "penta_v52" && paperRule;
      c.setAttribute("data-math-body", best ? "m.wallinfo.best.body" : "m.wallinfo.paper.body");
      if (best) chip("m.cast").setAttribute("data-math-body", "m.cast52.body");
    }
    if (b.room) {
      var r = b.room.def, rc = chip("m.roominfo");
      rc.setAttribute("data-math-vars", JSON.stringify({ k: r.room.length, w: r.wall26, w6: r.wall6, p: shapes[r.step].length, c: r.cubes, s: r.cubes - r.wall26, s6: r.cubes - r.wall6 }));
      if (r.room.length === 1) rc.setAttribute("data-math-title", "m.roominfo.title1");
      if (!paperRule) rc.setAttribute("data-math-body", "m.roominfo.f.body");
    }
    if (window.mathChip) window.mathChip.close();
  }

  // ---------- pointer ----------
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function aim(e) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  // What is under the pointer: a placed piece (and the cell beside the face
  // hit), the floor, or nothing.
  function pick(e) {
    aim(e);
    var targets = [cubes, floor].filter(Boolean);
    if (target) targets.push(target);
    var hits = ray.intersectObjects(targets, true);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.object === cubes && h.instanceId != null && h.instanceId < cubes.count) {
        var c = instanceCell[h.instanceId];
        if (!c || c[1] >= cut) continue;
        var n = h.face.normal;
        return { piece: instancePiece[h.instanceId], cell: c, point: h.point, next: [c[0] + Math.round(n.x), c[1] + Math.round(n.y), c[2] + Math.round(n.z)] };
      }
      if (target && h.object.parent === target && h.object.isMesh) {
        // A face of the room: build against it.
        var rc = board().room.cells.filter(function (q) { return q[1] < cut; })[target.children.filter(function (o) { return o.isMesh; }).indexOf(h.object)];
        if (!rc) continue;
        var nn = h.face.normal;
        return { piece: null, cell: null, next: [rc[0] + Math.round(nn.x), rc[1] + Math.round(nn.y), rc[2] + Math.round(nn.z)] };
      }
      if (h.object === floor) {
        var o = center(), s = board().space;
        var x = Math.floor(h.point.x + o.x), z = Math.floor(h.point.z + o.z);
        if (x < 0 || z < 0 || x >= s || z >= s) return null;
        return { piece: null, cell: null, next: [x, 0, z] };
      }
    }
    return null;
  }

  // Where a pointer reaches the horizontal plane at height y (in cells).
  function onPlane(e, y) {
    aim(e);
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    var o = center();
    return [p.x + o.x, p.z + o.z];
  }

  var pointers = new Map(), downAt = null, moved = 0, pinch = 0, drag = null;

  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY, type: e.pointerType };
      moved = 0;
      drag = null;
      // A press on the selected piece starts moving it.
      var b = board();
      if (!busy && !cast && !spread && b.sel != null) {
        var h = pick(e);
        // The piece follows the pointer on the level where it was grabbed.
        if (h && h.piece === b.sel) drag = { from: onPlane(e, h.point.y), y: h.point.y, cells: b.pieces[b.sel].cells };
      }
    }
    if (pointers.size === 2) { pinch = dist(); moved = 99; drag = null; dragGhost = null; }
  });
  canvas.addEventListener("pointermove", function (e) {
    var p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === "mouse" && !busy) hover(e);
      return;
    }
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      var d = dist();
      if (pinch) { view.r *= pinch / d; placeCamera(); }
      pinch = d;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved <= 6) return;
    if (drag && drag.from) {
      var to = onPlane(e, drag.y);
      if (!to) return;
      var ox = Math.round(to[0] - drag.from[0]), oz = Math.round(to[1] - drag.from[1]);
      var cells = drag.cells.map(function (c) { return [c[0] + ox, c[1], c[2] + oz]; });
      dragGhost = { cells: cells, ok: fits(cells, board().sel), moved: ox || oz };
      drawGhost();
      render();
      return;
    }
    view.theta -= dx * 0.008;
    view.phi -= dy * 0.008;
    placeCamera();
  });
  function end(e) {
    var wasTap = pointers.size === 1 && moved <= 6 && downAt;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (drag && dragGhost && e.type === "pointerup") {
      var b = board(), p = b.pieces[b.sel], cells = dragGhost.cells, go = dragGhost.moved;
      dragGhost = null;
      drag = null;
      // Dropped where it overlaps, it stays held, in red, like a turn.
      if (go && p) setHeld(cells, "cu.s.moved");
      else draw();
      return;
    }
    drag = null;
    dragGhost = null;
    if (wasTap && e.type === "pointerup") tap(e);
    if (!pointers.size) downAt = null;
  }
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && !pointers.size) { cursor = null; drawGhost(); render(); }
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    view.r *= Math.exp(e.deltaY * 0.0012);
    placeCamera();
  }, { passive: false });
  function dist() {
    var a = Array.from(pointers.values());
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  }

  function hover(e) {
    if (cast || board().hand == null) return;
    var h = pick(e);
    cursor = h ? h.next : null;
    drawGhost();
    render();
  }

  function tap(e) {
    if (busy) { say("cu.s.busy"); return; }
    if (cast) return;
    var b = board(), h = pick(e);
    if (b.hand != null) {
      if (!h) return;
      cursor = h.next;
      place(false);
      if (e.pointerType === "mouse") hover(e);
      return;
    }
    // While the wall is spread, taps only look.
    if (spread) return;
    if (h && h.piece != null) { select(h.piece); return; }
    letGo();
  }

  // ---------- keyboard ----------
  canvas.addEventListener("keydown", function (e) {
    if (busy || cast) return;
    var b = board(), dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", PageUp: "rise", PageDown: "sink" }[e.key];
    if (dir) {
      e.preventDefault();
      if (b.sel != null) { moveSelected(arrow(dir)); return; }
      if (b.hand == null) return;
      var s = b.space;
      if (!cursor) cursor = [Math.floor(s / 2), 0, Math.floor(s / 2)];
      var d = arrow(dir), c = [cursor[0] + d[0], cursor[1] + d[1], cursor[2] + d[2]];
      if (inSpace(c)) cursor = c;
      drawGhost();
      render();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (b.hand != null) { if (!cursor) cursor = [Math.floor(b.space / 2), 0, Math.floor(b.space / 2)]; place(true); }
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "range") return;
    if (busy) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === "r" || k === "R") turnBy("y");
    else if (k === "t" || k === "T") turnBy("x");
    else if (k === "q" || k === "Q") { view.theta += 0.2; placeCamera(); }
    else if (k === "e" || k === "E") { view.theta -= 0.2; placeCamera(); }
    else if (k === "+" || k === "=") { view.r *= 0.88; placeCamera(); }
    else if (k === "-" || k === "_") { view.r /= 0.88; placeCamera(); }
    else if (k === "Delete" || k === "Backspace") { if (board().sel != null) { e.preventDefault(); removeSelected(); } }
    else if (k === "Escape") letGo();
    else if (k === "[" || k === "]") {
      var b = board(), n = shapes[mode].length, i = b.hand == null ? (k === "]" ? n - 1 : 0) : b.hand;
      for (var j = 0; j < n; j++) {
        i = (i + (k === "]" ? 1 : n - 1)) % n;
        if (!isPlaced(i)) { chooseHand(i); return; }
      }
    }
  });

  // ---------- controls ----------
  function guard(fn) { return function () { if (busy) { say("cu.s.busy"); return; } fn.apply(null, arguments); }; }
  $("mode-tetra").addEventListener("click", guard(function () { setMode("tetra"); }));
  $("mode-penta").addEventListener("click", guard(function () { setMode("penta"); }));
  $("play-explore").addEventListener("click", guard(function () { setPlay("explore"); }));
  $("play-wrap").addEventListener("click", guard(function () { setPlay("wrap"); }));
  $("turn").addEventListener("click", guard(function () { turnBy("y"); }));
  $("tip").addEventListener("click", guard(function () { turnBy("x"); }));
  $("delete").addEventListener("click", guard(removeSelected));
  $("undo").addEventListener("click", guard(undo));
  $("clear").addEventListener("click", guard(clearAll));
  $("cast").addEventListener("click", toggleCast);
  document.querySelectorAll("[data-nudge]").forEach(function (btn) {
    btn.addEventListener("click", guard(function () { moveSelected(arrow(btn.getAttribute("data-nudge"))); }));
  });
  $("volume").addEventListener("click", function () { measure(); if (last.volume) sayVolume(); else say("cu.s.none"); });
  $("cut").addEventListener("input", function (e) {
    var v = +e.target.value;
    cut = v >= +e.target.max ? Infinity : v;
    draw();
  });
  $("spread").addEventListener("input", function (e) {
    spread = +e.target.value / 100;
    if (spread) { release(); board().sel = null; board().hand = null; cursor = null; }
    draw();
    ensureVisible();
  });
  document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () { if (window.i18n) window.i18n.setLang(btn.getAttribute("data-lang-btn")); });
  });
  document.addEventListener("fc-langchange", function () {
    document.title = t("cu.docTitle." + mode);
    syncTray();
    renderWalls();
    renderRooms();
    if (lastSaid) say(lastSaid[0], lastSaid[1]);
  });

  // ---------- files in and out ----------
  // The current wall in the wall-file shape [id, x, y, z] (z up).
  function exportWall() {
    var rows = [[0, 0, 0]], hi = [0, 0, 0];
    board().pieces.forEach(function (p, i) {
      p.cells.forEach(function (c) {
        var r = [i + 1, c[0], c[2], c[1]];
        for (var a = 0; a < 3; a++) hi[a] = Math.max(hi[a], r[a + 1] + 1);
        rows.push(r);
      });
    });
    rows[0] = hi;
    return JSON.stringify(rows);
  }

  // A wall file dropped on the space opens like the walls of the dock.
  canvas.addEventListener("dragover", function (e) { e.preventDefault(); });
  canvas.addEventListener("drop", function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    f.text().then(function (text) {
      var w = window.CubeSolutions.parse(JSON.parse(text));
      var all = [].concat.apply([], w.pieces), lo = [0, 1, 2].map(function (a) { return Math.min.apply(null, all.map(function (c) { return c[a]; })); });
      loadWall({ id: f.name, n: w.pieces[0].length, pieces: w.pieces.map(function (p) { return p.map(function (c) { return [c[0] - lo[0], c[2] - lo[2], c[1] - lo[1]]; }); }) });
    }).catch(function () { say("cu.s.noRoom"); });
  });

  // An SVG of the view: every visible face as a polygon, painter's order,
  // flat shading by face direction. which: "wall", "cast" (the room as a
  // solid) or "both" side by side; by default what the screen shows.
  function exportSvg(which) {
    which = which || (castGoal ? "cast" : "wall");
    if (which === "both") {
      var a = exportSvg("wall"), c = exportSvg("cast");
      var vb = a.match(/viewBox="0 0 (\d+) (\d+)"/), w = +vb[1], h = +vb[2];
      var inner = function (svg) { return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""); };
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (2 * w) + " " + h + '"><g>' + inner(a) + '</g><g transform="translate(' + w + ' 0)">' + inner(c) + "</g></svg>";
    }
    var r = canvas.getBoundingClientRect(), W = r.width, H = r.height;
    var polys = [], v = new THREE.Vector3(), off = new THREE.Vector3(), pos = new THREE.Vector3();
    var dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var shade = [0.62, 0.62, 1, 0.4, 0.8, 0.8];
    var keepCast = cast;
    cast = 0;
    var groups = which === "cast"
      ? [{ cells: last.enclosed, color: new THREE.Color(0xffd36e), still: true }]
      : board().pieces.map(function (p) { return { cells: p.cells, color: pieceColor(p, new THREE.Color()), piece: p }; });
    var occ = {};
    groups.forEach(function (g) { g.cells.forEach(function (q) { occ[G.key(q)] = true; }); });
    groups.forEach(function (gr) {
      if (gr.piece) pieceOffset(gr.piece, off); else off.set(0, 0, 0);
      gr.cells.forEach(function (q) {
        if (q[1] >= cut) return;
        cellPos(q, pos).add(off);
        dirs.forEach(function (d, di) {
          if ((!spread || gr.still) && occ[G.key([q[0] + d[0], q[1] + d[1], q[2] + d[2]])]) return;
          var normal = new THREE.Vector3(d[0], d[1], d[2]);
          var faceMid = pos.clone().addScaledVector(normal, CUBE / 2);
          if (camera.position.clone().sub(faceMid).dot(normal) <= 0) return;
          var ax = Math.abs(d[0]) ? [1, 2] : Math.abs(d[1]) ? [0, 2] : [0, 1];
          var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) {
            var w2 = faceMid.clone();
            w2.setComponent(ax[0], w2.getComponent(ax[0]) + k[0] * CUBE / 2);
            w2.setComponent(ax[1], w2.getComponent(ax[1]) + k[1] * CUBE / 2);
            return w2;
          });
          var depth = camera.position.distanceTo(faceMid);
          var pts = corners.map(function (w2) { v.copy(w2).project(camera); return ((v.x + 1) / 2 * W).toFixed(2) + "," + ((1 - v.y) / 2 * H).toFixed(2); });
          var f = gr.color.clone().multiplyScalar(shade[di]);
          polys.push({ depth: depth, s: '<polygon points="' + pts.join(" ") + '" fill="#' + f.getHexString() + '" stroke="#0d1117" stroke-width="0.6" stroke-linejoin="round"/>' });
        });
      });
    });
    cast = keepCast;
    polys.sort(function (p, q) { return q.depth - p.depth; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W.toFixed(0) + " " + H.toFixed(0) + '">' + polys.map(function (p) { return p.s; }).join("") + "</svg>";
  }

  // Where a cell sits on the screen (its top face, its middle, or the
  // floor under it), for tests.
  function screenOf(c, where) {
    var r = canvas.getBoundingClientRect(), p = cellPos(c, new THREE.Vector3());
    if (where === "top") p.y += CUBE / 2;
    if (where === "floor") p.y = 0;
    p.project(camera);
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }

  window.cubeLab = {
    svg: exportSvg,
    exportWall: exportWall,
    conn: CONN,
    screenOf: screenOf,
    // For tests: what a press at (x, y) would hit.
    hit: function (x, y) { var h = pick({ clientX: x, clientY: y }); return h ? { piece: h.piece, next: h.next } : null; },
    setView: function (theta, phi, r) { view.theta = theta; view.phi = phi; if (r) view.r = r; placeCamera(); },
    loadWall: function (id) { var w = WALLS.find(function (x) { return x.id === id; }); if (w) loadWall(w); },
    setMode: setMode,
    setPlay: setPlay,
    select: function (i) { select(i); },
    toggleCast: toggleCast,
    rooms: function () { return ROOMS.map(function (r) { return { id: r.id, step: r.step, room: r.room, witness: r.witness }; }); },
    // For tests: put pieces (lists of cells, shifted by `off`) on the board.
    place: function (list, off) {
      var b = board(), byCanon = {};
      off = off || [0, 0, 0];
      shapes[mode].forEach(function (sh) { byCanon[sh.canon] = sh.index; });
      list.forEach(function (cells) {
        b.pieces.push({ shape: byCanon[G.canon(cells)], cells: cells.map(function (c) { return [c[0] + off[0], c[1] + off[1], c[2] + off[2]]; }) });
      });
      measure();
      draw();
      ensureVisible();
    },
    state: function () {
      var b = board(), dist = camera.position.distanceTo(view.target);
      return { play: play, room: b.room ? b.room.id : null, roomCells: b.room ? b.room.cells : null, solved: solved, busy: busy,
        cast: cast, castGoal: castGoal, mode: mode, hand: b.hand, sel: b.sel, orient: b.orient, cursor: cursor,
        undo: b.undo.length, volume: last.volume, regions: last.regions, camR: dist, minR: view.minR, frames: frames,
        camTarget: view.target.toArray(), clash: b.sel != null && b.pieces[b.sel] ? !!b.pieces[b.sel].clash : false,
        pieces: b.pieces.map(function (p) { return { shape: p.shape, cells: p.cells }; }) };
    }
  };

  // ---------- size and loop ----------
  function resize() {
    var r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
    fit();
  }
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(canvas);

  // Draw only when something changed or moves.
  var frames = 0;
  function loop(now) {
    if (tween) {
      var q = Math.min(1, (now - tween.start) / 380), e = q * q * (3 - 2 * q);
      view.r = tween.from.r + (tween.to.r - tween.from.r) * e;
      view.target.lerpVectors(tween.from.t, tween.to.t, e);
      placeCamera();
      if (q >= 1) tween = null;
    }
    if (castAnim) {
      var k = Math.min(1, (now - castAnim.start) / 1100);
      cast = castAnim.from + (castGoal - castAnim.from) * k;
      if (k >= 1) { castAnim = null; if (!busy) fit(); }
      draw();
    }
    if (burst) {
      var u = (now - burst.userData.start) / 900, pos = burst.geometry.attributes.position, dirs = burst.userData.dirs, m = burst.userData.mid;
      for (var i = 0; i < pos.count; i++) pos.setXYZ(i, m.x + dirs[3 * i] * u * 4, m.y + dirs[3 * i + 1] * u * 4, m.z + dirs[3 * i + 2] * u * 4);
      pos.needsUpdate = true;
      burst.material.opacity = Math.max(0, 1 - u);
      dirty = true;
      if (u >= 1) {
        world.remove(burst);
        burst = null;
        // A short look at the room alone, then the wall comes back.
        busy = false;
        document.body.removeAttribute("data-busy");
        castGoal = 1;
        castAnim = { start: now, from: 0 };
        busy = true;
        document.body.setAttribute("data-busy", "");
        window.setTimeout(function () {
          castGoal = 0;
          castAnim = { start: performance.now(), from: cast };
          window.setTimeout(function () { busy = false; document.body.removeAttribute("data-busy"); draw(); }, 1150);
        }, 1500);
      }
    }
    if (dirty) { renderer.render(scene, camera); frames++; dirty = false; }
    requestAnimationFrame(loop);
  }

  renderWalls();
  refresh();
  resize();
  say("cu.s.start");
  requestAnimationFrame(loop);
})();
