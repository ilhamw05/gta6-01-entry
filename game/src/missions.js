// The story: six jobs for Mara Voss, the fixer who runs Port Solano from a downtown
// office above the old ferry terminal. Every mission is an original story written for this
// game. The controller is a small state machine: each mission is a list of steps (go to a
// place, pick something up, steal a car, outrun the police, race, escort, reach the boat),
// and the HUD reads the current step for its objective text and its minimap marker.
import { MISSION_REWARDS } from './config.js';
import { clamp, dist } from './world.js';

export const MISSIONS = [
  {
    id: 1, title: 'Paket Kilat', giver: 'Mara Voss', reward: MISSION_REWARDS[0],
    brief: [
      'Mara Voss: "Selamat datang di Port Solano, kurir. Ada paket di gudang dermaga."',
      'Mara Voss: "Antar ke kafe sudut Downtown sebelum 90 detik. Jangan sampai telat."',
    ],
    steps: [
      { kind: 'goto', label: 'Ambil paket di gudang dermaga', x: 3150, y: 2400, r: 90 },
      { kind: 'deliver', label: 'Antar paket ke kafe Downtown (90 dtk)', x: 1850, y: 700, r: 90, time: 90 },
    ],
  },
  {
    id: 2, title: 'Pesanan Khusus', giver: 'Mara Voss', reward: MISSION_REWARDS[1],
    brief: [
      'Mara Voss: "Pembeli di dermaga mau satu Marlin Coupe emas. Persis yang itu."',
      'Mara Voss: "Bawa ke dermaga. Kalau penyok parah, harganya jatuh. Hati-hati."',
    ],
    steps: [
      { kind: 'steal', label: 'Curi Marlin Coupe emas di Beachfront', x: 1250, y: 2700, r: 80 },
      { kind: 'deliverCar', label: 'Antar coupe emas ke dermaga', x: 3300, y: 2500, r: 110, maxDamage: 85 },
    ],
  },
  {
    id: 3, title: 'Lari dari Kejaran', giver: 'Mara Voss', reward: MISSION_REWARDS[2],
    brief: [
      'Mara Voss: "Polisi mengendus gudang kita. Kau harus mengalihkan mereka."',
      'Mara Voss: "Bikin keributan sampai bintang tiga, lalu kabur ke rumah aman di Suburbs."',
    ],
    steps: [
      { kind: 'escape', label: 'Kabur ke rumah aman dengan bintang 3', x: 700, y: 2400, r: 110 },
    ],
  },
  {
    id: 4, title: 'Balapan Jalanan', giver: 'Reno Kestrel', reward: MISSION_REWARDS[3],
    brief: [
      'Reno Kestrel: "Balapan tengah malam. Dua pembalap, empat pos, satu pemenang."',
      'Reno Kestrel: "Lewati semua pos sebelum mereka. Taruhannya? Gengsi dan uang."',
    ],
    steps: [
      { kind: 'race', label: 'Balapan: lewati 4 pos sebelum rival', x: 0, y: 0, r: 0 },
    ],
  },
  {
    id: 5, title: 'Kawal Kargo', giver: 'Mara Voss', reward: MISSION_REWARDS[4],
    brief: [
      'Mara Voss: "Truk kargo harus sampai ke gudang utara. Ada yang mau merampoknya."',
      'Mara Voss: "Kawal truknya. Kalau truk itu hancur, kita semua rugi."',
    ],
    steps: [
      { kind: 'escort', label: 'Kawal truk kargo ke gudang utara', x: 700, y: 600, r: 120 },
    ],
  },
  {
    id: 6, title: 'Pelarian Terakhir', giver: 'Mara Voss', reward: MISSION_REWARDS[5],
    brief: [
      'Mara Voss: "Ini dia. Seluruh kepolisian kota mengejarmu malam ini."',
      'Mara Voss: "Capai kapal di dermaga. Kalau kau sampai, kita bebas. Selamanya."',
    ],
    steps: [
      { kind: 'finale', label: 'Capai kapal di dermaga — bintang 5!', x: 3620, y: 2845, r: 120 },
    ],
  },
];

const RACE_POINTS = [
  { x: 1000, y: 350 }, { x: 3400, y: 950 }, { x: 3400, y: 2150 }, { x: 1000, y: 2650 },
];
const ESCORT_PATH = [
  { x: 3400, y: 2150 }, { x: 3400, y: 950 }, { x: 2200, y: 950 }, { x: 1000, y: 950 }, { x: 700, y: 600 },
];

export function createMissions(world, police, random) {
  const { state } = world;
  const ctrl = {
    index: 0,
    active: null,
    completed: [],
    failed: false,
    banner: '',
    bannerTimer: 0,
    dialogue: [],
    dialogueTimer: 0,
    prompt: '',
  };

  function say(lines) {
    ctrl.dialogue = [...lines];
    ctrl.dialogueTimer = 5.5;
  }

  function showBanner(text, seconds) {
    ctrl.banner = text;
    ctrl.bannerTimer = seconds;
  }

  function officePoint() {
    const o = state.city.maraOffice;
    return { x: o.x + o.w / 2, y: o.y + o.h + 60 };
  }

  function spawnCarAt(x, y, modelName, color, extra) {
    const car = {
      id: 5000 + Math.floor(random() * 9000), x, y, angle: random() * Math.PI * 2,
      speed: 0, model: { name: modelName, color, top: 560 }, color, top: 560,
      parked: true, traffic: false, police: false, racer: false, escort: false, attacker: false,
      gold: false, damage: 0, smoke: 0, hp: 100, driver: false,
      roadAxis: 'v', road: 2200, dir: 1, targetAngle: 0, cruise: 300, stopTimer: 0,
      ...extra,
    };
    state.cars.push(car);
    return car;
  }

  function startMission(i) {
    const def = MISSIONS[i];
    const active = {
      def, stepIdx: 0, timer: 0, goldCar: null, truck: null, racers: [],
      raceIdx: 0, racerIdx: [0, 0], escortIdx: 0, attackers: [], finished: false,
    };
    ctrl.active = active;
    ctrl.failed = false;
    say(def.brief);
    showBanner(`MISI ${def.id}: ${def.title}`, 3.5);
    const step = def.steps[0];
    if (step.kind === 'escape') police.addHeat(3);
    if (step.kind === 'finale') police.addHeat(5);
    if (step.kind === 'steal') {
      active.goldCar = spawnCarAt(step.x, step.y, 'Marlin Coupe', '#e8c93c', { gold: true, parked: true });
    }
    if (step.kind === 'race') {
      active.racers = [
        spawnCarAt(950, 350, 'Kelpie Compact', '#c94f4f', { racer: true, parked: false, driver: true }),
        spawnCarAt(1050, 350, 'Dune Runner', '#4f7ac9', { racer: true, parked: false, driver: true }),
      ];
      active.racers[0].raceTarget = 0;
      active.racers[1].raceTarget = 0;
    }
    if (step.kind === 'escort') {
      active.truck = spawnCarAt(3400, 2150, 'Tide Van', '#e8e8e8', { escort: true, parked: false, driver: true, hp: 100 });
      active.truck.escortTarget = 0;
      active.attackers = [
        spawnCarAt(3000, 2150, 'Cinder Pickup', '#3f9a4a', { attacker: true, parked: false, driver: true }),
        spawnCarAt(3400, 1800, 'Vesper Sedan', '#8a8f96', { attacker: true, parked: false, driver: true }),
      ];
    }
    return active;
  }

  function failMission(reason) {
    ctrl.active = null;
    ctrl.failed = true;
    showBanner(`MISI GAGAL — ${reason}`, 4);
    say(['Mara Voss: "Gagal. Tenang, kita coba lagi. Kembali ke kantorku kalau sudah siap."']);
    police.clearWanted();
  }

  function completeMission() {
    const active = ctrl.active;
    const def = active.def;
    state.player.cash += def.reward;
    state.stats.cashEarned += def.reward;
    state.stats.missionsDone += 1;
    ctrl.completed.push(def.id);
    ctrl.index = Math.min(MISSIONS.length, ctrl.index + 1);
    ctrl.active = null;
    showBanner(`MISI SELESAI! +$${def.reward}`, 4);
    say([`Mara Voss: "Bagus. $${def.reward} sudah masuk. Istirahat dulu, kurir."`]);
    police.clearWanted();
    if (ctrl.index >= MISSIONS.length) {
      state.flags.storyComplete = true;
      showBanner('CERITA SELESAI — Port Solano milikmu!', 6);
      say(['Mara Voss: "Kau bebas, kurir. Kota ini sekarang mengenal namamu."']);
    }
  }

  function stepRace(active, dt) {
    const p = state.player;
    const cp = RACE_POINTS[active.raceIdx];
    if (!cp) { completeMission(); return; }
    if (dist(p.x, p.y, cp.x, cp.y) < 110) {
      active.raceIdx += 1;
      world.addParticles(cp.x, cp.y, '#58d68a', 16, 220);
      if (active.raceIdx >= RACE_POINTS.length) { completeMission(); return; }
    }
    // Rival racers drive the same checkpoints.
    for (let i = 0; i < active.racers.length; i += 1) {
      const racer = active.racers[i];
      if (racer.hp <= 0) continue;
      const target = RACE_POINTS[active.racerIdx[i]];
      if (!target) continue;
      const want = Math.atan2(target.y - racer.y, target.x - racer.x);
      let diff = want - racer.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      racer.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      racer.speed += (430 - racer.speed) * Math.min(1, dt);
      racer.x += Math.cos(racer.angle) * racer.speed * dt;
      racer.y += Math.sin(racer.angle) * racer.speed * dt;
      world.resolveCircle(racer, 24);
      if (dist(racer.x, racer.y, target.x, target.y) < 110) {
        active.racerIdx[i] += 1;
        if (active.racerIdx[i] >= RACE_POINTS.length) {
          failMission('Rival sampai duluan di garis akhir');
          return;
        }
      }
    }
  }

  function stepEscort(active, dt) {
    const truck = active.truck;
    if (!truck || truck.hp <= 0) {
      failMission('Truk kargo hancur');
      return;
    }
    const target = ESCORT_PATH[active.escortIdx];
    if (!target) { completeMission(); return; }
    const want = Math.atan2(target.y - truck.y, target.x - truck.x);
    let diff = want - truck.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    truck.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
    truck.speed += (200 - truck.speed) * Math.min(1, dt);
    truck.x += Math.cos(truck.angle) * truck.speed * dt;
    truck.y += Math.sin(truck.angle) * truck.speed * dt;
    world.resolveCircle(truck, 24);
    if (dist(truck.x, truck.y, target.x, target.y) < 110) {
      active.escortIdx += 1;
      if (active.escortIdx >= ESCORT_PATH.length) { completeMission(); return; }
    }
    // Attackers ram the truck.
    for (const atk of active.attackers) {
      if (atk.hp <= 0) continue;
      const a = Math.atan2(truck.y - atk.y, truck.x - atk.x);
      let d2 = a - atk.angle;
      while (d2 > Math.PI) d2 -= Math.PI * 2;
      while (d2 < -Math.PI) d2 += Math.PI * 2;
      atk.angle += clamp(d2, -2.6 * dt, 2.6 * dt);
      atk.speed += (380 - atk.speed) * Math.min(1, dt);
      atk.x += Math.cos(atk.angle) * atk.speed * dt;
      atk.y += Math.sin(atk.angle) * atk.speed * dt;
      world.resolveCircle(atk, 24);
      if (dist(atk.x, atk.y, truck.x, truck.y) < 62) {
        truck.hp -= 14 * dt * 4;
        truck.damage += 4 * dt * 4;
        atk.speed *= 0.5;
        world.addParticles(truck.x, truck.y, '#ff5a4a', 4, 160);
      }
    }
  }

  function update(dt) {
    if (ctrl.bannerTimer > 0) ctrl.bannerTimer -= dt;
    if (ctrl.dialogueTimer > 0) ctrl.dialogueTimer -= dt;
    const active = ctrl.active;
    if (!active) {
      // Idle: show the prompt when the player stands by Mara's office.
      const office = officePoint();
      const p = state.player;
      ctrl.prompt = ctrl.index < MISSIONS.length && dist(p.x, p.y, office.x, office.y) < 110
        ? `Tekan E untuk memulai Misi ${ctrl.index + 1}: ${MISSIONS[ctrl.index].title}`
        : '';
      return;
    }
    ctrl.prompt = '';
    const step = active.def.steps[active.stepIdx];
    const p = state.player;
    if (step.time) {
      active.timer += dt;
      if (active.timer > step.time) {
        failMission('Waktu habis');
        return;
      }
    }
    if (step.kind === 'goto' || step.kind === 'deliver') {
      if (dist(p.x, p.y, step.x, step.y) < step.r) {
        if (step.kind === 'goto' && active.stepIdx === 0) {
          world.addParticles(p.x, p.y, '#58d68a', 14, 200);
          say(['Paket didapat. Sekarang antar ke tujuan sebelum waktu habis!']);
        }
        active.stepIdx += 1;
        active.timer = 0;
        if (active.stepIdx >= active.def.steps.length) completeMission();
      }
    } else if (step.kind === 'steal') {
      if (p.inCar === active.goldCar) {
        active.stepIdx += 1;
        say(['Mara Voss: "Itu dia. Sekarang bawa ke dermaga, jangan sampai penyok."']);
      } else if (active.goldCar && active.goldCar.hp <= 0) {
        failMission('Mobil target hancur');
      }
    } else if (step.kind === 'deliverCar') {
      if (p.inCar !== active.goldCar) {
        // Player left the gold car: point them back to it.
      } else if (dist(p.x, p.y, step.x, step.y) < step.r) {
        if (active.goldCar.damage > step.maxDamage) failMission('Mobil terlalu penyok');
        else completeMission();
      }
    } else if (step.kind === 'escape') {
      if (state.wantedHeat < 2) police.addHeat(2.2 - state.wantedHeat);
      if (dist(p.x, p.y, step.x, step.y) < step.r) completeMission();
    } else if (step.kind === 'race') {
      stepRace(active, dt);
    } else if (step.kind === 'escort') {
      stepEscort(active, dt);
    } else if (step.kind === 'finale') {
      if (state.wantedHeat < 4.5) police.addHeat(5 - state.wantedHeat);
      if (dist(p.x, p.y, step.x, step.y) < step.r) completeMission();
    }
  }

  /** The current objective for the HUD and the minimap marker. */
  function objective() {
    if (ctrl.active) {
      const active = ctrl.active;
      const step = active.def.steps[Math.min(active.stepIdx, active.def.steps.length - 1)];
      if (step.kind === 'race') {
        const cp = RACE_POINTS[Math.min(active.raceIdx, RACE_POINTS.length - 1)];
        return { label: `${step.label} — pos ${Math.min(active.raceIdx + 1, 4)}/4`, x: cp.x, y: cp.y, timeLeft: 0 };
      }
      if (step.kind === 'escort') {
        const t = active.truck;
        return { label: `${step.label} — truk ${Math.max(0, Math.round(t ? t.hp : 0))}%`, x: t ? t.x : step.x, y: t ? t.y : step.y, timeLeft: 0 };
      }
      if (step.kind === 'steal' && active.goldCar) {
        return { label: step.label, x: active.goldCar.x, y: active.goldCar.y, timeLeft: 0 };
      }
      const timeLeft = step.time ? Math.max(0, step.time - active.timer) : 0;
      return { label: step.label, x: step.x, y: step.y, timeLeft };
    }
    if (ctrl.index < MISSIONS.length) {
      const office = officePoint();
      return { label: `Misi ${ctrl.index + 1}: ${MISSIONS[ctrl.index].title} — ke kantor Mara`, x: office.x, y: office.y, timeLeft: 0 };
    }
    return { label: 'Bebas berkeliaran di Port Solano', x: 0, y: 0, timeLeft: 0 };
  }

  function marker() {
    const obj = objective();
    return obj.x === 0 && obj.y === 0 ? null : { x: obj.x, y: obj.y };
  }

  function tryStart() {
    if (ctrl.active || ctrl.index >= MISSIONS.length) return false;
    const office = officePoint();
    const p = state.player;
    if (dist(p.x, p.y, office.x, office.y) < 110) {
      startMission(ctrl.index);
      return true;
    }
    return false;
  }

  function retry() {
    if (!ctrl.failed) return;
    ctrl.failed = false;
    startMission(ctrl.index);
  }

  return {
    ctrl, MISSIONS, update, objective, marker, tryStart, retry, startMission,
    officePoint, RACE_POINTS, ESCORT_PATH, showBanner, say,
  };
}
