// The HUD and the minimap for Solano Vice: health, cash, wanted stars, the car you are in,
// the current objective, the clock, and a live minimap of Port Solano. Everything here
// draws in screen space (1280x720); the renderer switches to this space before calling it.
import { FONT, PALETTE, WORLD } from './config.js';
import { dist } from './world.js';

const MM = { x: 1040, y: 16, w: 224, h: 168 };
const MM_SX = MM.w / WORLD.width;
const MM_SY = MM.h / WORLD.height;

const fonts = new Map();
function text(ctx, value, x, y, size, color, align, weight) {
  const key = `${weight || ''}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
  ctx.font = fonts.get(key);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function star(ctx, cx, cy, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawHud(ctx, world, missions, police) {
  const { state } = world;
  const p = state.player;
  ctx.textBaseline = 'alphabetic';

  // Top-left: health bar, cash, vehicle.
  ctx.fillStyle = PALETTE.hudBack;
  ctx.fillRect(14, 12, 250, 84);
  text(ctx, 'KESEHATAN', 24, 34, 13, PALETTE.muted, 'left', 'bold ');
  bar(ctx, 24, 42, 180, 12, p.hp / 100, p.hp > 35 ? PALETTE.ok : PALETTE.danger, '#222');
  text(ctx, `${Math.max(0, Math.ceil(p.hp))}`, 212, 54, 14, PALETTE.text, 'left', 'bold ');
  text(ctx, `$${Math.floor(p.cash)}`, 24, 80, 22, PALETTE.gold, 'left', 'bold ');
  const carName = p.inCar ? p.inCar.model.name : 'Jalan kaki';
  text(ctx, carName, 150, 80, 15, PALETTE.text, 'left');
  if (p.inCar && p.inCar.damage > 0) {
    text(ctx, `Kerusakan ${Math.round(p.inCar.damage)}%`, 24, 108, 13, p.inCar.damage > 60 ? PALETTE.danger : PALETTE.muted, 'left');
  }

  // Top-centre: wanted stars.
  const stars = state.wanted;
  const starX = 640 - (stars * 34) / 2;
  for (let i = 0; i < 5; i += 1) {
    star(ctx, starX + 17 + i * 34, 34, 13, i < stars ? '#ffd75e' : 'rgba(255,255,255,0.18)');
  }
  if (stars > 0) {
    text(ctx, stars >= 3 ? 'POLISI MENGEJAR!' : 'WANTED', 640, 62, 14, PALETTE.danger, 'center', 'bold ');
  }

  // Objective line under the stars.
  const obj = missions.objective();
  ctx.fillStyle = PALETTE.hudBack;
  const label = `▸ ${obj.label}`;
  ctx.font = `bold 16px ${FONT}`;
  const lw = ctx.measureText(label).width;
  ctx.fillRect(640 - lw / 2 - 14, 72, lw + 28, 28);
  text(ctx, label, 640, 92, 16, PALETTE.objective, 'center', 'bold ');
  if (obj.timeLeft > 0) {
    text(ctx, `${Math.ceil(obj.timeLeft)} dtk`, 640, 118, 18, obj.timeLeft < 15 ? PALETTE.danger : PALETTE.text, 'center', 'bold ');
  }

  // Clock, bottom-left.
  const h = Math.floor(state.clockHours);
  const m = Math.floor((state.clockHours - h) * 60);
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  text(ctx, clock, 24, 700, 20, PALETTE.text, 'left', 'bold ');
  text(ctx, `Misi ${Math.min(missions.ctrl.index + 1, 6)}/6  •  Selesai ${state.stats.missionsDone}`, 24, 676, 14, PALETTE.muted, 'left');

  // Mission prompt near the bottom centre.
  if (missions.ctrl.prompt) {
    ctx.font = `bold 17px ${FONT}`;
    const pw = ctx.measureText(missions.ctrl.prompt).width;
    ctx.fillStyle = PALETTE.hudBack;
    ctx.fillRect(640 - pw / 2 - 14, 628, pw + 28, 32);
    text(ctx, missions.ctrl.prompt, 640, 650, 17, PALETTE.text, 'center', 'bold ');
  }

  drawMinimap(ctx, world, missions, police);
}

function drawMinimap(ctx, world, missions, police) {
  const { state } = world;
  ctx.fillStyle = 'rgba(8, 12, 18, 0.78)';
  ctx.fillRect(MM.x - 4, MM.y - 4, MM.w + 8, MM.h + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(MM.x, MM.y, MM.w, MM.h);
  ctx.clip();
  // Water and land.
  ctx.fillStyle = '#274b2e';
  ctx.fillRect(MM.x, MM.y, MM.w, MM.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(MM.x, MM.y + (2900 * MM_SY), MM.w, MM.h - 2900 * MM_SY);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(MM.x, MM.y + (2820 * MM_SY), MM.w, 80 * MM_SY);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (const x of [400, 1000, 1600, 2200, 2800, 3400]) {
    ctx.fillRect(MM.x + x * MM_SX - 3, MM.y, 6, MM.h);
  }
  for (const y of [350, 950, 1550, 2150, 2650]) {
    ctx.fillRect(MM.x, MM.y + y * MM_SY - 3, MM.w, 6);
  }
  // The park.
  ctx.fillStyle = '#4a7a3f';
  ctx.fillRect(MM.x + 1669 * MM_SX, MM.y + 1619 * MM_SY, 460 * MM_SX, 460 * MM_SY);
  // Mission marker: pulsing gold diamond.
  const marker = missions.marker();
  if (marker) {
    const pulse = 5 + Math.sin(state.elapsed * 5) * 2;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(MM.x + marker.x * MM_SX, MM.y + marker.y * MM_SY - pulse - 4);
    ctx.lineTo(MM.x + marker.x * MM_SX + pulse, MM.y + marker.y * MM_SY);
    ctx.lineTo(MM.x + marker.x * MM_SX, MM.y + marker.y * MM_SY + pulse + 4);
    ctx.lineTo(MM.x + marker.x * MM_SX - pulse, MM.y + marker.y * MM_SY);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic dots, police dots, pedestrians.
  for (const car of state.cars) {
    if (car.hp <= 0) continue;
    ctx.fillStyle = car.police ? (Math.floor(state.elapsed * 6) % 2 === 0 ? '#ff5a4a' : '#4f7ac9') : '#e8e8e8';
    ctx.fillRect(MM.x + car.x * MM_SX - 2, MM.y + car.y * MM_SY - 2, 4, 4);
  }
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(MM.x + ped.x * MM_SX - 1, MM.y + ped.y * MM_SY - 1, 2, 2);
  }
  // Player arrow.
  const p = state.player;
  const px = MM.x + p.x * MM_SX;
  const py = MM.y + p.y * MM_SY;
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(p.angle) * 8, py + Math.sin(p.angle) * 8);
  ctx.lineTo(px + Math.cos(p.angle + 2.5) * 6, py + Math.sin(p.angle + 2.5) * 6);
  ctx.lineTo(px + Math.cos(p.angle - 2.5) * 6, py + Math.sin(p.angle - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'PORT SOLANO', MM.x + MM.w / 2, MM.y + MM.h + 20, 12, PALETTE.muted, 'center', 'bold ');
}

/** Dialogue subtitles at the bottom of the screen. */
export function drawDialogue(ctx, missions) {
  const lines = missions.ctrl.dialogue;
  if (!lines.length || missions.ctrl.dialogueTimer <= 0) return;
  const line = lines[0];
  ctx.font = `16px ${FONT}`;
  const w = Math.min(980, ctx.measureText(line).width + 32);
  ctx.fillStyle = 'rgba(8, 12, 18, 0.82)';
  ctx.fillRect(640 - w / 2, 588, w, 30);
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText(line, 640, 608);
}

/** Big centre banner (mission start / complete / failed). */
export function drawBanner(ctx, missions) {
  if (missions.ctrl.bannerTimer <= 0 || !missions.ctrl.banner) return;
  ctx.font = `bold 34px ${FONT}`;
  const w = ctx.measureText(missions.ctrl.banner).width + 48;
  ctx.fillStyle = 'rgba(8, 12, 18, 0.82)';
  ctx.fillRect(640 - w / 2, 250, w, 58);
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'center';
  ctx.fillText(missions.ctrl.banner, 640, 290);
}

export function drawSaveFlash(ctx, text2) {
  ctx.font = `bold 16px ${FONT}`;
  const w = ctx.measureText(text2).width + 28;
  ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
  ctx.fillRect(640 - w / 2, 560, w, 30);
  ctx.fillStyle = PALETTE.ok;
  ctx.textAlign = 'center';
  ctx.fillText(text2, 640, 580);
}

export { dist };
