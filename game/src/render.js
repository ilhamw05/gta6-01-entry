// Drawing only: the city, the cars, the people, the panels. The renderer takes the world
// state and the screen the game is on, and paints one frame. The 1280x720 view follows a
// camera over Port Solano; the HUD is drawn in screen space on top.
import {
  FONT, PALETTE, ROADS_H, ROADS_V, ROAD_WIDTH, VIEW, WORLD,
} from './config.js';
import { drawBanner, drawDialogue, drawHud, drawSaveFlash } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_END = 'end';

const fonts = new Map();
function font(size, weight) {
  const key = `${weight || ''}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
  return fonts.get(key);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawGround(world, daylight) {
    const cam = world.state.camera;
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x - 20, cam.y - 20, VIEW.width + 40, VIEW.height + 40);
    // Beach and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.beachY, WORLD.width, WORLD.waterY - WORLD.beachY);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
    context.fillStyle = PALETTE.waterDeep;
    for (let y = WORLD.waterY + 26; y < WORLD.height; y += 52) {
      context.fillRect(0, y, WORLD.width, 5);
    }
    // Harbor Park lawn.
    const park = world.state.city.park;
    context.fillStyle = PALETTE.park;
    context.fillRect(park.x, park.y, park.w, park.h);
    // Sidewalks: pale strips hugging every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_V) {
      context.fillRect(x - ROAD_WIDTH / 2 - 16, 0, 16, WORLD.beachY);
      context.fillRect(x + ROAD_WIDTH / 2, 0, 16, WORLD.beachY);
    }
    for (const y of ROADS_H) {
      context.fillRect(0, y - ROAD_WIDTH / 2 - 16, WORLD.width, 16);
      context.fillRect(0, y + ROAD_WIDTH / 2, WORLD.width, 16);
    }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const x of ROADS_V) context.fillRect(x - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD.beachY);
    for (const y of ROADS_H) context.fillRect(0, y - ROAD_WIDTH / 2, WORLD.width, ROAD_WIDTH);
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const x of ROADS_V) {
      for (let y = 30; y < WORLD.beachY; y += 64) context.fillRect(x - 2, y, 4, 32);
    }
    for (const y of ROADS_H) {
      for (let x = 30; x < WORLD.width; x += 64) context.fillRect(x, y - 2, 32, 4);
    }
    // Road edges.
    context.strokeStyle = PALETTE.roadEdge;
    context.lineWidth = 3;
    for (const x of ROADS_V) {
      context.beginPath(); context.moveTo(x - ROAD_WIDTH / 2, 0); context.lineTo(x - ROAD_WIDTH / 2, WORLD.beachY); context.stroke();
      context.beginPath(); context.moveTo(x + ROAD_WIDTH / 2, 0); context.lineTo(x + ROAD_WIDTH / 2, WORLD.beachY); context.stroke();
    }
    void daylight;
  }

  function drawBuildings(world) {
    const city = world.state.city;
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 3;
      context.strokeRect(b.x, b.y, b.w, b.h);
      if (b.tall) {
        context.fillStyle = 'rgba(255,255,255,0.16)';
        for (let wy = b.y + 14; wy < b.y + b.h - 14; wy += 26) {
          for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 24) {
            context.fillRect(wx, wy, 12, 14);
          }
        }
      } else {
        // Windows in a small grid and a door on the south edge.
        context.fillStyle = 'rgba(255,255,255,0.13)';
        for (let wy = b.y + 14; wy < b.y + b.h - 20; wy += 30) {
          for (let wx = b.x + 12; wx < b.x + b.w - 16; wx += 30) {
            context.fillRect(wx, wy, 14, 12);
          }
        }
        context.fillStyle = 'rgba(0,0,0,0.28)';
        context.fillRect(b.x + b.w / 2 - 11, b.y + b.h - 18, 22, 18);
      }
    }
    for (const c of city.containers) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(c.x + 4, c.y + 5, c.w, c.h);
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = '#22262d';
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(c.x + (c.w / 5) * i, c.y);
        context.lineTo(c.x + (c.w / 5) * i, c.y + c.h);
        context.stroke();
      }
    }
    for (const crane of city.cranes) {
      context.strokeStyle = '#c9a52e';
      context.lineWidth = 8;
      context.beginPath();
      context.moveTo(crane.x, crane.y);
      context.lineTo(crane.x, crane.y - 150);
      context.lineTo(crane.x + 170, crane.y - 150);
      context.stroke();
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(crane.x + 170, crane.y - 150);
      context.lineTo(crane.x + 120, crane.y - 40);
      context.stroke();
    }
  }

  function drawTrees(world) {
    for (const t of world.state.city.trees) {
      context.fillStyle = '#5a4632';
      context.fillRect(t.x - 2, t.y - 2, 4, 6);
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.treeLight;
      context.beginPath();
      context.arc(t.x - t.r * 0.25, t.y - t.r * 0.35, t.r * 0.55, 0, Math.PI * 2);
      context.fill();
    }
    for (const lamp of world.state.city.lamps) {
      context.fillStyle = '#3a3f47';
      context.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-34, -17, 68, 34);
    // Wheels.
    context.fillStyle = '#14161a';
    context.fillRect(-24, -17, 12, 6);
    context.fillRect(-24, 11, 12, 6);
    context.fillRect(12, -17, 12, 6);
    context.fillRect(12, 11, 12, 6);
    // Body.
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-32, -15, 64, 30, 8);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 2;
    context.stroke();
    // Windshield and roof.
    context.fillStyle = 'rgba(20,30,44,0.85)';
    context.fillRect(8, -11, 12, 22);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    context.fillRect(-8, -11, 16, 22);
    if (car.police) {
      context.fillStyle = '#e8e8e8';
      context.fillRect(-32, -15, 64, 8);
      context.fillStyle = '#2e4a8a';
      context.fillRect(-32, 7, 64, 8);
      const flash = Math.floor(time * 5) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      context.fillRect(-6, -19, 12, 6);
      context.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      context.fillRect(6, -19, 12, 6);
    }
    if (car.gold) {
      context.strokeStyle = '#ffd75e';
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(-36, -19, 72, 38, 10);
      context.stroke();
    }
    if (car.damage > 40) {
      context.fillStyle = 'rgba(40,40,40,0.55)';
      context.beginPath();
      context.arc(-20 + (car.damage % 20), 0, 8, 0, Math.PI * 2);
      context.fill();
    }
    // Headlights.
    context.fillStyle = '#fff8c9';
    context.fillRect(30, -11, 3, 6);
    context.fillRect(30, 5, 3, 6);
    context.restore();
    if (car.smoke > 0 && Math.sin(car.x * 0.37 + time * 9) > 0.2) {
      context.fillStyle = 'rgba(120,120,120,0.5)';
      context.beginPath();
      context.arc(car.x - 20, car.y - 6, 5 + car.smoke * 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPed(ped) {
    if (ped.hp <= 0) {
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 4, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c9a0';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 5.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(world) {
    const p = world.state.player;
    if (p.inCar) return;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(p.x, p.y + 5, 13, 6, 0, 0, Math.PI * 2);
    context.fill();
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (!blink) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.playerDark;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#e8c9a0';
      context.beginPath();
      context.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 6, 0, Math.PI * 2);
      context.fill();
      if (p.punchAnim > 0) {
        context.strokeStyle = PALETTE.player;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
        context.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
        context.stroke();
      }
    }
  }

  function drawMarker(world, missions) {
    const marker = missions.marker();
    if (!marker) return;
    const t = world.state.elapsed;
    const bob = Math.sin(t * 3) * 4;
    context.fillStyle = 'rgba(242, 201, 76, 0.16)';
    context.beginPath();
    context.moveTo(marker.x - 10, marker.y);
    context.lineTo(marker.x + 10, marker.y);
    context.lineTo(marker.x + 4, marker.y - 130 + bob);
    context.lineTo(marker.x - 4, marker.y - 130 + bob);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.save();
    context.translate(marker.x, marker.y - 34 + bob);
    context.rotate(Math.PI / 4);
    context.fillRect(-9, -9, 18, 18);
    context.restore();
    context.fillStyle = '#7a5a00';
    context.beginPath();
    context.arc(marker.x, marker.y - 34 + bob, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawCheckpoints(world, missions) {
    const active = missions.ctrl.active;
    if (!active || active.def.steps[0].kind !== 'race') return;
    const points = missions.RACE_POINTS;
    for (let i = 0; i < points.length; i += 1) {
      const cp = points[i];
      const done = i < active.raceIdx;
      context.strokeStyle = done ? PALETTE.ok : PALETTE.gold;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cp.x, cp.y, 60, 0, Math.PI * 2);
      context.stroke();
      text(String(i + 1), cp.x, cp.y + 8, 28, done ? PALETTE.ok : PALETTE.gold, 'center', 'bold ');
    }
  }

  function drawParticles(world) {
    for (const pt of world.state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.globalAlpha = 1;
  }

  function drawWorld(world, missions, police) {
    const cam = world.state.camera;
    context.save();
    context.translate(-Math.round(cam.x), -Math.round(cam.y));
    const daylight = world.daylight();
    drawGround(world, daylight);
    drawBuildings(world);
    drawTrees(world);
    drawCheckpoints(world, missions);
    drawMarker(world, missions);
    for (const ped of world.state.peds) drawPed(ped);
    for (const officer of police.officers) {
      if (officer.active) drawPed({ ...officer, shirt: '#2e4a8a' });
    }
    for (const car of world.state.cars) {
      // A wrecked car stays on the street; only wrecks nobody drives are skipped.
      if (car.hp <= 0 && !car.parked && car !== world.state.player.inCar) continue;
      drawCar(car, world.state.elapsed);
    }
    drawPlayer(world);
    drawParticles(world);
    context.restore();
    // Day-night tint in screen space.
    if (daylight < 1) {
      context.fillStyle = daylight < 0.3 ? PALETTE.night : PALETTE.dusk;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 64;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.text, 'center', 'bold ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 116 + i * 32, 18, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 26, 20, PALETTE.gold, 'center', 'bold ');
  }

  const TITLE_LINES = [
    'Port Solano — kota pesisir yang tidak pernah tidur.',
    'Mara Voss menunggumu di kantor Downtown. Enam pekerjaan. Satu jalan keluar.',
    'Jalan kaki: WASD • Lari: Shift • Pukul: Spasi/J • Masuk mobil: E',
    'Nyetir: W/S gas-rem • A/D belok • Spasi rem tangan • H klakson • P jeda • G simpan',
  ];
  const PAUSE_LINES = ['Istirahat sejenak. Kota menunggu.', 'Tekan G untuk menyimpan permainan.'];
  const BUSTED_LINES = ['Polisi menangkapmu. Denda dibayar, bintang hilang.', ''];
  const WASTED_LINES = ['Kau tumbang di jalanan Port Solano.', ''];
  const END_LINES = ['Semua enam misi selesai. Port Solano mengenal namamu.', ''];

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(world, missions, police, screen, saveFlash, hasSaveGame) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(world, missions, police);
    if (screen === SCREEN_TITLE) {
      const lines = [...TITLE_LINES];
      if (hasSaveGame) lines.push('Save ditemukan — tekan Enter untuk Lanjutkan, atau N untuk permainan baru.');
      drawPanel('SOLANO VICE', lines, hasSaveGame ? 'Enter: Lanjutkan   •   N: Permainan baru' : 'Tekan Spasi atau klik untuk mulai', PALETTE.gold);
      return;
    }
    drawHud(context, world, missions, police);
    drawDialogue(context, missions);
    drawBanner(context, missions);
    if (saveFlash) drawSaveFlash(context, saveFlash);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', PAUSE_LINES, 'Tekan P untuk lanjut', PALETTE.text);
    } else if (screen === SCREEN_BUSTED) {
      BUSTED_LINES[1] = `Denda $200 — uangmu sekarang $${Math.floor(world.state.player.cash)}.`;
      drawPanel('TERTANGKAP!', BUSTED_LINES, 'Tekan Spasi untuk kembali ke jalanan', PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      WASTED_LINES[1] = `Biaya rumah sakit $100 — uangmu sekarang $${Math.floor(world.state.player.cash)}.`;
      drawPanel('TUMBANG!', WASTED_LINES, 'Tekan Spasi untuk bangkit lagi', PALETTE.danger);
    } else if (screen === SCREEN_END) {
      drawPanel('CERITA SELESAI', END_LINES, 'Port Solano milikmu — tekan Spasi untuk bebas berkeliaran', PALETTE.ok);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
