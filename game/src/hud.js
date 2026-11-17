// The HUD: health, cash, wanted stars, the clock, the objective line, dialogs, banners —
// and the minimap in the corner that the whole city fits into. Drawn in screen space by
// render.js after the world; everything here is flat shapes and text, no images.
import { AVENUES, BEACH_X, CAR_MODELS, PLACES, SEA_X, STREETS, WORLD } from './config.js';
import { carById, wantedStars } from './world.js';
import { missionMarker, objectiveText } from './missions.js';

function star(g, cx, cy, r, filled) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.22)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1;
  g.stroke();
}

function wrapText(g, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The corner minimap: the whole of Port Solano, roads, water, dots for every player in the game. */
export function drawMinimap(g, state, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#2e4a2a';
  g.fillRect(x, y, w, h);
  // Sea and beach.
  g.fillStyle = '#d9c28a';
  g.fillRect(x + BEACH_X * sx, y, (SEA_X - BEACH_X) * sx, h);
  g.fillStyle = '#1d5f7a';
  g.fillRect(x + SEA_X * sx, y, (WORLD.width - SEA_X) * sx, h);
  // Harbor Park.
  g.fillStyle = '#3f7a3a';
  g.fillRect(x + 2820 * sx, y, 728 * sx, 1080 * sy);
  // Roads.
  g.strokeStyle = 'rgba(230,230,220,0.75)';
  g.lineWidth = Math.max(1, 120 * sx);
  for (const ax of AVENUES) {
    g.beginPath();
    g.moveTo(x + ax * sx, y);
    g.lineTo(x + ax * sx, y + h);
    g.stroke();
  }
  for (const syLine of STREETS) {
    g.beginPath();
    g.moveTo(x, y + syLine * sy);
    g.lineTo(x + BEACH_X * sx, y + syLine * sy);
    g.stroke();
  }
  // Traffic as pale dots, police as flashing blue/red.
  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.driver === 'police') {
      g.fillStyle = Math.floor(state.time * 3) % 2 === 0 ? '#3f8cff' : '#ff4d4d';
    } else if (car.driver === 'player') continue;
    else g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
  }
  // The mission marker, a pulsing gold diamond.
  const marker = missionMarker(state);
  if (marker) {
    const mx = x + marker.x * sx;
    const my = y + marker.y * sy;
    const r = 4 + Math.sin(state.time * 5) * 1.3;
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.moveTo(mx, my - r);
    g.lineTo(mx + r, my);
    g.lineTo(mx, my + r);
    g.lineTo(mx - r, my);
    g.closePath();
    g.fill();
  }
  // The player: a white arrow that turns with them.
  const p = state.player;
  const px = x + p.x * sx;
  const py = y + p.y * sy;
  g.translate(px, py);
  g.rotate(p.angle);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4, 5);
  g.lineTo(0, 2.4);
  g.lineTo(-4, 5);
  g.closePath();
  g.fill();
  g.restore();
  // Frame and caption.
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '600 9px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('PORT SOLANO', x + 5, y + h - 5);
}

/** Everything overlaid on the world while playing. */
export function drawHud(g, state, w, h) {
  const p = state.player;
  g.save();
  g.textBaseline = 'alphabetic';

  // Health bar, top-left.
  g.fillStyle = 'rgba(10,12,16,0.55)';
  g.fillRect(14, 14, 224, 46);
  g.fillStyle = '#20242c';
  g.fillRect(22, 22, 200, 13);
  const hpFrac = Math.max(0, p.hp / 100);
  g.fillStyle = hpFrac > 0.3 ? '#7ac74f' : '#e0483e';
  g.fillRect(22, 22, 200 * hpFrac, 13);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1;
  g.strokeRect(22, 22, 200, 13);
  g.fillStyle = '#ffffff';
  g.font = '700 17px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(`$${p.cash.toLocaleString('en-US')}`, 22, 54);

  // Wanted stars and the clock, top-right.
  const stars = wantedStars(state);
  for (let i = 0; i < 5; i += 1) {
    star(g, w - 30 - i * 34, 32, 13, i < stars);
  }
  const hh = Math.floor(state.clock / 60);
  const mm = Math.floor(state.clock % 60);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = '600 15px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, w - 18, 66);

  // Minimap, bottom-left.
  drawMinimap(g, state, 14, h - 176, 216, 162);

  // Vehicle readout, bottom-right, while driving.
  if (p.carId !== null) {
    const car = carById(state, p.carId);
    if (car) {
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.font = '700 16px system-ui, sans-serif';
      g.fillText(CAR_MODELS[car.model].name, w - 16, h - 40);
      g.font = '600 13px system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText(`${Math.round(Math.abs(car.speed) * 0.36)} km/h`, w - 16, h - 20);
    }
  } else {
    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = '500 12px system-ui, sans-serif';
    g.fillText('WASD move · Shift run · Space punch · E enter car · P pause', w - 16, h - 16);
  }

  // Dialog box, bottom-centre, when someone is talking.
  const dialog = state.mission?.dialog;
  if (dialog) {
    const [speaker, text] = dialog.lines[dialog.i];
    const bw = Math.min(620, w - 320);
    const bx = (w - bw) / 2;
    const by = h - 118;
    g.fillStyle = 'rgba(8,10,14,0.78)';
    g.fillRect(bx, by, bw, 62);
    g.strokeStyle = 'rgba(255,210,63,0.5)';
    g.strokeRect(bx, by, bw, 62);
    g.textAlign = 'left';
    g.fillStyle = '#ffd23f';
    g.font = '700 13px system-ui, sans-serif';
    g.fillText(speaker.toUpperCase(), bx + 14, by + 20);
    g.fillStyle = '#f2f2f2';
    g.font = '400 14px system-ui, sans-serif';
    const lines = wrapText(g, text, bw - 28).slice(0, 2);
    lines.forEach((line, i) => g.fillText(line, bx + 14, by + 40 + i * 16));
  } else {
    // Objective line, bottom-centre.
    const text = objectiveText(state);
    if (text) {
      g.font = '600 14px system-ui, sans-serif';
      const tw = g.measureText(text).width + 28;
      const bx = (w - tw) / 2;
      g.fillStyle = 'rgba(8,10,14,0.6)';
      g.fillRect(bx, h - 42, tw, 28);
      g.fillStyle = '#ffe9a8';
      g.textAlign = 'center';
      g.fillText(text, w / 2, h - 23);
    }
  }

  // Mission banner, upper-centre.
  const banner = state.mission?.banner;
  if (banner) {
    const fade = banner.t > 3.2 ? Math.max(0, 1 - (banner.t - 3.2) / 0.8) : 1;
    g.globalAlpha = fade;
    g.textAlign = 'center';
    g.font = '800 26px system-ui, sans-serif';
    g.fillStyle = banner.good ? '#ffd23f' : '#ff6b5e';
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 8;
    g.fillText(banner.text, w / 2, 108);
    g.shadowBlur = 0;
    g.globalAlpha = 1;
  }

  // Hurt flash and low-health pulse.
  if (p.hurtT > 0) {
    g.fillStyle = `rgba(200,30,20,${0.18 * (p.hurtT / 0.25)})`;
    g.fillRect(0, 0, w, h);
  } else if (p.hp > 0 && p.hp < 30) {
    g.strokeStyle = `rgba(220,40,30,${0.25 + 0.2 * Math.sin(state.time * 6)})`;
    g.lineWidth = 10;
    g.strokeRect(0, 0, w, h);
  }
  g.restore();
}
