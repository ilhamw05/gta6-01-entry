// The renderer: Port Solano from above — ground, roads, rooftops, cars, people — plus the
// title, pause and arrest/death screens. Pure canvas, flat colours, a fake drop-shadow on
// the buildings for height. Nothing here changes the world; it only reads the state.
import {
  AVENUES, BEACH_X, CAR_MODELS, DISTRICTS, PLACES, SEA_X, STREETS, WORLD,
} from './config.js';
import { PIER, darkness } from './world.js';
import { drawHud } from './hud.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

/** Deterministic 0..1 hash of a position, for window speckles and wave offsets. */
function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGround(state, view) {
    const { x0, y0, x1, y1 } = view;
    for (let i = DISTRICTS.length - 1; i >= 0; i -= 1) {
      const d = DISTRICTS[i];
      g.fillStyle = d.ground;
      g.fillRect(Math.max(d.x, x0), Math.max(d.y, y0), Math.min(d.x + d.w, x1) - Math.max(d.x, x0), Math.min(d.y + d.h, y1) - Math.max(d.y, y0));
    }
    // Sand and sea.
    g.fillStyle = '#d9c28a';
    g.fillRect(BEACH_X, y0, SEA_X - BEACH_X, y1 - y0);
    g.fillStyle = '#1d5f7a';
    g.fillRect(SEA_X, y0, WORLD.width - SEA_X, y1 - y0);
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 2;
    for (let wy = Math.floor(y0 / 52) * 52; wy < y1; wy += 52) {
      g.beginPath();
      for (let wx = SEA_X + 6; wx < x1; wx += 26) {
        const yy = wy + Math.sin((wx + wy) * 0.05 + state.time * 1.4) * 3;
        if (wx === SEA_X + 6) g.moveTo(wx, yy);
        else g.lineTo(wx, yy);
      }
      g.stroke();
    }
    // Sidewalks then asphalt.
    g.fillStyle = '#9aa0a3';
    for (const ax of AVENUES) g.fillRect(ax - 80, y0, 160, y1 - y0);
    for (const sy of STREETS) g.fillRect(x0, sy - 80, Math.min(SEA_X + 60, x1) - x0, 160);
    g.fillStyle = '#3c4147';
    for (const ax of AVENUES) g.fillRect(ax - 60, y0, 120, y1 - y0);
    for (const sy of STREETS) g.fillRect(x0, sy - 60, Math.min(SEA_X + 60, x1) - x0, 120);
    // Centre dashes.
    g.fillStyle = '#d8b93a';
    for (const ax of AVENUES) {
      for (let y = Math.floor(y0 / 64) * 64; y < y1; y += 64) g.fillRect(ax - 2, y, 4, 34);
    }
    for (const sy of STREETS) {
      for (let x = Math.floor(x0 / 64) * 64; x < Math.min(SEA_X, x1); x += 64) g.fillRect(x, sy - 2, 34, 4);
    }
    // Crosswalks at intersections.
    g.fillStyle = 'rgba(235,235,235,0.5)';
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        if (ax + 90 < x0 || ax - 90 > x1 || sy + 90 < y0 || sy - 90 > y1) continue;
        for (let s = -48; s <= 48; s += 16) {
          g.fillRect(ax + s - 5, sy - 74, 10, 12);
          g.fillRect(ax + s - 5, sy + 62, 10, 12);
          g.fillRect(ax - 74, sy + s - 5, 12, 10);
          g.fillRect(ax + 62, sy + s - 5, 12, 10);
        }
      }
    }
    // The pier.
    g.fillStyle = '#8a6a42';
    g.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
    g.strokeStyle = 'rgba(60,40,20,0.5)';
    g.lineWidth = 2;
    for (let px = PIER.x + 24; px < PIER.x + PIER.w; px += 24) {
      g.beginPath();
      g.moveTo(px, PIER.y);
      g.lineTo(px, PIER.y + PIER.h);
      g.stroke();
    }
    // The Ferryman's boat, moored at the pier's end.
    g.save();
    g.translate(PLACES.boat.x, PLACES.boat.y);
    g.fillStyle = '#e8e8ec';
    rrect(g, -16, -52, 32, 104, 12);
    g.fill();
    g.fillStyle = '#0e7c86';
    rrect(g, -11, -20, 22, 44, 6);
    g.fill();
    g.restore();
  }

  function drawBuildings(state, view) {
    const { x0, y0, x1, y1 } = view;
    for (const b of state.city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      const drop = Math.min(18, 4 + b.floors * 1.1);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      g.fillStyle = b.wall;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = b.roof;
      g.fillRect(b.x, b.y, b.w, b.h - drop);
      // Windows along the sunlit south face.
      g.fillStyle = 'rgba(255,240,190,0.55)';
      const cols = Math.floor(b.w / 22);
      for (let i = 0; i < cols; i += 1) {
        if (hash(b.x + i * 22, b.y) > 0.4) g.fillRect(b.x + 8 + i * 22, b.y + b.h - drop + 3, 9, 5);
      }
      // A skylight or two on the roof.
      g.fillStyle = 'rgba(255,255,255,0.13)';
      if (b.w > 90) g.fillRect(b.x + b.w * 0.2, b.y + 10, 26, 16);
      if (b.w > 170) g.fillRect(b.x + b.w * 0.65, b.y + 12, 30, 18);
      if (b.label) {
        g.fillStyle = '#ffffff';
        g.font = '800 17px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
      }
    }
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(t.x + 3, t.y + 5, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2f6b2f';
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3f8a3a';
      g.beginPath();
      g.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.62, 0, Math.PI * 2);
      g.fill();
    }
    for (const c of state.city.crates) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      g.fillStyle = '#a5713d';
      g.fillRect(c.x, c.y, c.s, c.s);
      g.strokeStyle = 'rgba(70,45,20,0.7)';
      g.lineWidth = 2;
      g.strokeRect(c.x, c.y, c.s, c.s);
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.lineTo(c.x + c.s, c.y + c.s);
      g.moveTo(c.x + c.s, c.y);
      g.lineTo(c.x, c.y + c.s);
      g.stroke();
    }
    for (const lamp of state.city.lamps) {
      if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
      g.fillStyle = '#2b2f36';
      g.beginPath();
      g.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawCar(car, state) {
    const model = CAR_MODELS[car.model];
    const { w, l } = model;
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.angle);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    rrect(g, -w / 2 + 3, -l / 2 + 5, w, l, 7);
    g.fill();
    // Wheels.
    g.fillStyle = '#15181d';
    const ww = 6;
    g.fillRect(-w / 2 - 2, -l / 2 + 9, ww, 13);
    g.fillRect(w / 2 - ww + 2, -l / 2 + 9, ww, 13);
    g.fillRect(-w / 2 - 2, l / 2 - 22, ww, 13);
    g.fillRect(w / 2 - ww + 2, l / 2 - 22, ww, 13);
    // Body.
    g.fillStyle = car.dead ? '#3a3f45' : car.color;
    rrect(g, -w / 2, -l / 2, w, l, 7);
    g.fill();
    if (car.model === 6) {
      // Hauler: cab at the front, cargo box behind.
      g.fillStyle = 'rgba(20,24,30,0.85)';
      rrect(g, -w / 2 + 5, -l / 2 + 8, w - 10, 13, 3);
      g.fill();
      g.fillStyle = car.dead ? '#4a4640' : '#c8b490';
      rrect(g, -w / 2 + 2, -l / 2 + 30, w - 4, l - 34, 3);
      g.fill();
    } else {
      // Glasshouse and roof.
      g.fillStyle = 'rgba(16,22,30,0.88)';
      rrect(g, -w / 2 + 4, -l / 2 + 13, w - 8, 15, 3);
      g.fill();
      g.fillStyle = car.dead ? '#454a50' : car.color;
      rrect(g, -w / 2 + 5, -l / 2 + 30, w - 10, l - 52, 4);
      g.fill();
      g.fillStyle = 'rgba(16,22,30,0.75)';
      rrect(g, -w / 2 + 5, l / 2 - 19, w - 10, 9, 3);
      g.fill();
    }
    // Lights.
    g.fillStyle = '#ffeeb0';
    g.fillRect(-w / 2 + 4, -l / 2, 7, 3);
    g.fillRect(w / 2 - 11, -l / 2, 7, 3);
    g.fillStyle = '#d23b2e';
    g.fillRect(-w / 2 + 4, l / 2 - 3, 7, 3);
    g.fillRect(w / 2 - 11, l / 2 - 3, 7, 3);
    // Police lightbar.
    if (car.tag === 'police') {
      const phase = Math.floor(state.time * 2.6) % 2 === 0;
      g.fillStyle = phase ? '#ff3b30' : '#5a1712';
      g.fillRect(-w / 2 + 4, -6, w / 2 - 5, 9);
      g.fillStyle = phase ? '#1e2a38' : '#3f8cff';
      g.fillRect(1, -6, w / 2 - 5, 9);
    }
    // Damage shading.
    if (!car.dead && car.hp < car.maxHp * 0.55) {
      g.fillStyle = 'rgba(20,20,20,0.25)';
      rrect(g, -w / 2, -l / 2, w, l * 0.4, 7);
      g.fill();
    }
    g.restore();
    // The player's marker chevron.
    if (car.driver === 'player') {
      const bob = Math.sin(state.time * 4) * 3;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(car.x, car.y - model.l / 2 - 18 + bob);
      g.lineTo(car.x - 8, car.y - model.l / 2 - 30 + bob);
      g.lineTo(car.x + 8, car.y - model.l / 2 - 30 + bob);
      g.closePath();
      g.fill();
    }
  }

  function drawPed(ped, state) {
    g.save();
    g.translate(ped.x, ped.y);
    if (ped.down) {
      g.rotate(ped.angle + Math.PI / 2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(2, 3, 14, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ped.shirt;
      g.beginPath();
      g.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8b98a';
      g.beginPath();
      g.arc(13, 0, 4.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
      return;
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.rotate(ped.angle);
    g.fillStyle = ped.shirt;
    g.beginPath();
    g.arc(0, 0, 8.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8b98a';
    g.beginPath();
    g.arc(0, -2.5, 4.6, 0, Math.PI * 2);
    g.fill();
    if (ped.cop) {
      g.fillStyle = '#16222e';
      g.beginPath();
      g.arc(0, -3.4, 4.8, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd23f';
      g.fillRect(4.5, -1.5, 3, 3);
    }
    g.restore();
  }

  function drawWorld(state, camX, camY) {
    const w = canvas.width;
    const h = canvas.height;
    const view = { x0: camX - w / 2 - 90, y0: camY - h / 2 - 90, x1: camX + w / 2 + 90, y1: camY + h / 2 + 90 };
    const shakeX = state.shake > 0 ? Math.sin(state.time * 91) * state.shake : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 83) * state.shake : 0;
    g.save();
    g.translate(w / 2 - camX + shakeX, h / 2 - camY + shakeY);
    drawGround(state, view);
    drawBuildings(state, view);
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      g.save();
      g.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        g.fillStyle = '#2e7d32';
        rrect(g, -11, -7, 22, 14, 2);
        g.fill();
        g.fillStyle = '#a5d6a7';
        g.font = '800 11px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('$', 0, 4);
      } else {
        g.fillStyle = '#f5f5f5';
        rrect(g, -9, -9, 18, 18, 3);
        g.fill();
        g.fillStyle = '#d23b2e';
        g.fillRect(-2.5, -6, 5, 12);
        g.fillRect(-6, -2.5, 12, 5);
      }
      g.restore();
    }
    // Mission marker: a pillar of light and a floating diamond.
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
      const grad = g.createLinearGradient(0, marker.y - 190, 0, marker.y);
      grad.addColorStop(0, 'rgba(255,210,63,0)');
      grad.addColorStop(1, `rgba(255,210,63,${0.25 + pulse * 0.15})`);
      g.fillStyle = grad;
      g.fillRect(marker.x - 13, marker.y - 190, 26, 190);
      g.strokeStyle = `rgba(255,210,63,${0.5 + pulse * 0.4})`;
      g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(marker.x, marker.y, 26 + pulse * 6, 12 + pulse * 3, 0, 0, Math.PI * 2);
      g.stroke();
      const bobY = marker.y - 52 + Math.sin(state.time * 3) * 5;
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(marker.x, bobY - 15);
      g.lineTo(marker.x + 11, bobY);
      g.lineTo(marker.x, bobY + 15);
      g.lineTo(marker.x - 11, bobY);
      g.closePath();
      g.fill();
      g.fillStyle = '#20242c';
      g.font = '900 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(marker.label, marker.x, bobY + 5.5);
    }
    for (const ped of state.peds) drawPed(ped, state);
    for (const car of state.cars) drawCar(car, state);
    // The player on foot.
    const p = state.player;
    if (p.carId === null && !state.over) {
      g.save();
      g.translate(p.x, p.y);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 14, 0, Math.PI * 2);
      g.stroke();
      g.rotate(p.angle);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0e7c86';
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffe0b2';
      g.beginPath();
      g.arc(0, -2.5, 4.8, 0, Math.PI * 2);
      g.fill();
      // A punching arm mid-swing.
      if (p.punchCd > 0.22) {
        g.fillStyle = '#ffe0b2';
        g.beginPath();
        g.arc(6, -13, 3.4, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    // Particles.
    for (const pt of state.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      g.fillStyle = pt.color;
      g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    g.globalAlpha = 1;
    g.restore();

    // Night: darkness, then lamp and headlight glow.
    const dark = darkness(state);
    if (dark > 0.01) {
      g.fillStyle = `rgba(8,14,44,${dark})`;
      g.fillRect(0, 0, w, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(w / 2 - camX + shakeX, h / 2 - camY + shakeY);
      for (const lamp of state.city.lamps) {
        if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
        const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 52);
        grad.addColorStop(0, 'rgba(255,214,130,0.20)');
        grad.addColorStop(1, 'rgba(255,214,130,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(lamp.x, lamp.y, 52, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  function drawTitle(state, ui) {
    const w = canvas.width;
    const h = canvas.height;
    const camX = 2150 + Math.sin(state.time * 0.05) * 360;
    const camY = 1380 + Math.cos(state.time * 0.037) * 240;
    drawWorld(state, camX, camY);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(5,8,16,0.55)');
    grad.addColorStop(0.55, 'rgba(5,8,16,0.25)');
    grad.addColorStop(1, 'rgba(5,8,16,0.72)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.fillStyle = '#ffd23f';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 18;
    g.font = '900 92px system-ui, sans-serif';
    g.fillText('SOLANO VICE', w / 2, 168);
    g.shadowBlur = 0;
    g.fillStyle = '#f5f0e6';
    g.font = '600 21px system-ui, sans-serif';
    g.fillText('P O R T   S O L A N O', w / 2, 208);
    g.font = '400 17px system-ui, sans-serif';
    g.fillStyle = 'rgba(245,240,230,0.92)';
    g.fillText('Six districts, one fixer, and every badge in the city between you and the boat.', w / 2, 268);
    g.fillText('Work Mara Voss\'s six jobs — or just steal something fast and see the lights.', w / 2, 294);
    g.font = '500 15px system-ui, sans-serif';
    g.fillStyle = 'rgba(245,240,230,0.75)';
    g.fillText('WASD / arrows — move & drive · Shift — run · Space / J — punch · E / F — enter car · H — horn · P / Esc — pause', w / 2, h - 118);
    g.font = '800 24px system-ui, sans-serif';
    g.fillStyle = '#ffd23f';
    const prompt = ui.hasSave ? 'ENTER — Continue      N — New Game' : 'ENTER — New Game';
    g.fillText(prompt, w / 2, h - 66);
    if (ui.storyDone) {
      g.font = '700 15px system-ui, sans-serif';
      g.fillStyle = '#7ac74f';
      g.fillText('★ STORY COMPLETE — the city is yours ★', w / 2, h - 34);
    }
  }

  function drawOver(state) {
    const w = canvas.width;
    const h = canvas.height;
    const busted = state.over === 'busted';
    g.fillStyle = busted ? 'rgba(16,36,86,0.5)' : 'rgba(96,12,12,0.5)';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.font = '900 84px system-ui, sans-serif';
    g.fillStyle = busted ? '#7fb2ff' : '#ff7a6e';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 16;
    g.fillText(busted ? 'B U S T E D' : 'W A S T E D', w / 2, h / 2 - 10);
    g.shadowBlur = 0;
    g.font = '500 17px system-ui, sans-serif';
    g.fillStyle = '#f5f0e6';
    g.fillText(
      busted ? 'The city takes its cut and wipes your record clean.' : 'The hospital patches you up and bills you for the trouble.',
      w / 2, h / 2 + 34,
    );
  }

  /** Paint one frame. screen is SCREEN_TITLE, SCREEN_PLAY or SCREEN_PAUSED. */
  function draw(state, screen, ui = {}) {
    const w = canvas.width;
    const h = canvas.height;
    g.fillStyle = '#10131a';
    g.fillRect(0, 0, w, h);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    const p = state.player;
    const camX = Math.max(w / 2 - 170, Math.min(WORLD.width - w / 2 + 170, p.x));
    const camY = Math.max(h / 2 - 170, Math.min(WORLD.height - h / 2 + 170, p.y));
    drawWorld(state, camX, camY);
    drawHud(g, state, w, h);
    if (state.over) drawOver(state);
    if (screen === SCREEN_PAUSED) {
      g.fillStyle = 'rgba(5,8,12,0.55)';
      g.fillRect(0, 0, w, h);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      g.font = '900 54px system-ui, sans-serif';
      g.fillText('PAUSED', w / 2, h / 2);
      g.font = '500 16px system-ui, sans-serif';
      g.fillText('P or Esc to keep driving', w / 2, h / 2 + 34);
    }
  }

  return { draw, resize };
}
