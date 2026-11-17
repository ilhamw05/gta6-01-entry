// The story of Solano Vice: six jobs for Mara Voss, the fixer who runs Port Solano from a
// downtown office. This module is the mission engine (markers, dialogs, objectives, rewards)
// and the six mission scripts themselves. Missions run one at a time, in order; between them
// the player free-roams to Mara's door for the next job.
import { CAR_MODELS, HEAT, PLACES } from './config.js';
import { carById, commitCrime, makeCar, wantedStars } from './world.js';
import { driveToward } from './traffic.js';
import { moveCar } from './world.js';

export const MISSION_REWARDS = [300, 450, 600, 800, 1000, 1500];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Say lines: a queue of [speaker, text] shown in the dialog box, one at a time. */
function say(state, lines) {
  state.mission.dialog = { lines, i: 0, t: 0 };
}

function banner(state, text, good = true) {
  state.mission.banner = { text, good, t: 0 };
}

function finish(state, runtime) {
  const reward = MISSION_REWARDS[runtime.def];
  state.player.cash += reward;
  state.fx.push('missiondone');
  banner(state, `Job done — $${reward}`);
  state.mission.next = runtime.def + 1;
  state.mission.active = null;
  if (runtime.def === 5) {
    state.storyDone = true;
    banner(state, `Story complete — $${reward}. Port Solano is yours.`);
  }
}

function fail(state, reason) {
  state.fx.push('missionfail');
  banner(state, `Job failed — ${reason}`, false);
  state.mission.active = null;
}

/** Called by main when the player is arrested or wrecked mid-mission. */
export function failActiveMission(state, why) {
  if (state.mission?.active) fail(state, why);
}

const MISSIONS = [
  {
    title: 'First Errand',
    intro: [
      ['Mara Voss', 'New face, old city. I move packages, not questions.'],
      ['Mara Voss', 'A parcel waits in Old Town. Bring it to Rosa\'s café, downtown. The clock is not your friend.'],
    ],
    setup(state) {
      return { phase: 'pickup', target: { ...PLACES.packageSpot }, timer: null };
    },
    update(state, rt, dt) {
      if (rt.phase === 'pickup') {
        if (dist(state.player, rt.target) < 46) {
          rt.phase = 'deliver';
          rt.target = { ...PLACES.truckDest };
          rt.timer = 120;
          state.fx.push('pickup');
          say(state, [['Mara Voss', 'Got it? Good. Rosa is waiting — two minutes, no sightseeing.']]);
        }
        return null;
      }
      rt.timer -= dt;
      if (rt.timer <= 0) return 'the café went cold';
      if (dist(state.player, rt.target) < 52) return 'done';
      return null;
    },
    objective(rt) {
      return rt.phase === 'pickup' ? 'Pick up the package in Old Town' : `Deliver the package to Rosa's café — ${Math.max(0, Math.ceil(rt.timer))}s`;
    },
  },
  {
    title: 'Mint Condition',
    intro: [
      ['Mara Voss', 'A golden Marlin Coupe sleeps in the North Suburbs. Its owner owes me.'],
      ['Mara Voss', 'Steal it, and bring it to my docks garage without a scratch worth naming.'],
    ],
    setup(state) {
      const coupe = state.cars.find((c) => c.tag === 'coupe');
      return { phase: 'steal', coupeId: coupe?.id, target: null };
    },
    update(state, rt) {
      const coupe = carById(state, rt.coupeId);
      if (!coupe || coupe.dead) return 'the coupe is wrecked';
      rt.target = { x: coupe.x, y: coupe.y };
      if (rt.phase === 'steal') {
        if (state.player.carId === coupe.id) rt.phase = 'deliver';
        return null;
      }
      if (state.player.carId === coupe.id) {
        rt.target = { ...PLACES.docksGarage };
        if (dist(state.player, rt.target) < 64) {
          if (coupe.hp < coupe.maxHp * 0.5) return 'the coupe arrived half-dead';
          return 'done';
        }
      }
      return null;
    },
    objective(rt) {
      return rt.phase === 'steal' ? 'Steal the golden Marlin Coupe' : 'Deliver the coupe to the docks garage, gently';
    },
  },
  {
    title: 'Heat Run',
    intro: [
      ['Mara Voss', 'Tonight you are bait. Draw every badge in Port Solano after you.'],
      ['Mara Voss', 'Three stars on your head — then lose yourself at the Harbor Park safehouse.'],
    ],
    setup(state) {
      state.heat = Math.max(state.heat, HEAT.missionCrime + 220); // three stars, on the house
      return { phase: 'run', target: { ...PLACES.safehouse } };
    },
    update(state, rt) {
      if (dist(state.player, rt.target) < 56) return 'done';
      return null;
    },
    objective() {
      return 'Reach the Harbor Park safehouse with the heat on';
    },
  },
  {
    title: 'Harbor Sprint',
    intro: [
      ['Reno Kestrel', 'Six lights around the bay, sweetheart. My crew runs them in four minutes.'],
      ['Mara Voss', 'Beat Reno\'s two drivers through every checkpoint. Pride pays cash here.'],
    ],
    setup(state) {
      const cps = [
        { x: 3300, y: 420 }, { x: 2220, y: 420 }, { x: 2220, y: 1740 },
        { x: 3300, y: 1740 }, { x: 3300, y: 2400 }, { x: 3300, y: 1080 },
      ];
      const rivals = [];
      const spots = [
        { x: 3264, y: 1330 }, { x: 3336, y: 1330 },
      ];
      for (let i = 0; i < 2; i += 1) {
        const car = makeCar(state, i === 0 ? 4 : 5, spots[i].x, spots[i].y, Math.PI, i === 0 ? '#a31f34' : '#2a9d8f');
        car.driver = 'mission';
        car.tag = 'rival';
        car.cp = 0;
        state.cars.push(car);
        rivals.push(car.id);
      }
      return { phase: 'count', t: 3, cps, playerCp: 0, rivals, target: { ...PLACES.raceStart } };
    },
    update(state, rt, dt) {
      if (rt.phase === 'count') {
        rt.t -= dt;
        if (rt.t <= 0) { rt.phase = 'race'; state.fx.push('go'); }
        return null;
      }
      // Rivals chase their next light.
      for (const id of rt.rivals) {
        const car = carById(state, id);
        if (!car || car.dead) continue;
        if (car.cp >= rt.cps.length) continue;
        const cp = rt.cps[car.cp];
        if (Math.hypot(car.x - cp.x, car.y - cp.y) < 95) { car.cp += 1; continue; }
        const { steer, throttle } = driveToward(state, car, cp.x, cp.y, dt, 0.92);
        moveCar(state, car, throttle, steer, dt);
      }
      const anyRivalDone = rt.rivals.some((id) => (carById(state, id)?.cp ?? 0) >= rt.cps.length);
      if (anyRivalDone && rt.playerCp < rt.cps.length) return 'Reno\'s crew took the lights';
      if (state.player.carId === null) { rt.target = { ...PLACES.raceStart }; return null; }
      const cp = rt.cps[rt.playerCp];
      if (!cp) return 'done';
      rt.target = { x: cp.x, y: cp.y };
      if (dist(state.player, cp) < 95) {
        rt.playerCp += 1;
        state.fx.push('checkpoint');
        if (rt.playerCp >= rt.cps.length) return 'done';
      }
      return null;
    },
    objective(rt) {
      if (rt.phase === 'count') return `Get ready… ${Math.ceil(rt.t)}`;
      return `Harbor Sprint — checkpoint ${Math.min(rt.playerCp + 1, rt.cps.length)} of ${rt.cps.length}`;
    },
    cleanup(state, rt) {
      for (const id of rt.rivals) {
        const car = carById(state, id);
        if (car && car.driver === 'mission') car.driver = 'parked';
      }
    },
  },
  {
    title: 'Convoy Guard',
    intro: [
      ['Captain Ilya Brandt', 'My Hauler carries the harbour payroll. Every rat in the docks knows.'],
      ['Mara Voss', 'Ride shotgun. Keep Ilya\'s truck rolling to the downtown depot — and keep it whole.'],
    ],
    setup(state) {
      const truck = makeCar(state, 6, PLACES.truckStart.x, PLACES.truckStart.y, -Math.PI / 2, '#7a4a21');
      truck.driver = 'mission';
      truck.tag = 'truck';
      state.cars.push(truck);
      return {
        phase: 'escort', truckId: truck.id, target: { ...PLACES.truckDest },
        route: [
          { x: 2280, y: 2460 }, { x: 2220, y: 1740 }, { x: 2220, y: 1140 },
          { x: 2040, y: 1080 }, { ...PLACES.truckDest },
        ],
        wp: 0, awayT: 0, ambushT: 6, ambushers: [],
      };
    },
    update(state, rt, dt) {
      const truck = carById(state, rt.truckId);
      if (!truck || truck.dead) return 'the truck is destroyed';
      rt.target = { x: truck.x, y: truck.y };
      // The truck follows its route at hauler pace.
      const wp = rt.route[rt.wp];
      if (wp) {
        if (Math.hypot(truck.x - wp.x, truck.y - wp.y) < 80) rt.wp += 1;
        else {
          const { steer, throttle } = driveToward(state, truck, wp.x, wp.y, dt, 0.5);
          moveCar(state, truck, throttle, steer, dt);
        }
      }
      // Ambushers arrive in waves and go for the truck.
      rt.ambushT -= dt;
      if (rt.ambushT <= 0 && rt.ambushers.length < 3) {
        rt.ambushT = 16;
        const a = makeCar(state, 2, truck.x + 620, truck.y - 500, 0, '#77353a');
        a.driver = 'mission';
        a.tag = 'ambusher';
        state.cars.push(a);
        rt.ambushers.push(a.id);
        say(state, [['Ilya Brandt', 'Company! Keep them off my rig!']]);
      }
      for (const id of rt.ambushers) {
        const a = carById(state, id);
        if (!a || a.dead) continue;
        const { steer, throttle } = driveToward(state, a, truck.x, truck.y, dt, 0.95);
        moveCar(state, a, throttle, steer, dt);
      }
      // The player must stay with the convoy.
      const d = dist(state.player, truck);
      if (d > 520) {
        rt.awayT += dt;
        if (rt.awayT > 10) return 'you lost the convoy';
      } else rt.awayT = Math.max(0, rt.awayT - dt);
      if (dist(truck, PLACES.truckDest) < 84) return 'done';
      return null;
    },
    objective(rt) {
      return rt.awayT > 1 ? `Get back to the truck — ${Math.ceil(10 - rt.awayT)}s` : 'Escort the Hauler to the downtown depot';
    },
    cleanup(state, rt) {
      const truck = carById(state, rt.truckId);
      if (truck && truck.driver === 'mission') truck.driver = 'parked';
      for (const id of rt.ambushers) {
        const a = carById(state, id);
        if (a && a.driver === 'mission') a.driver = 'traffic';
      }
    },
  },
  {
    title: 'Last Boat Out',
    intro: [
      ['Mara Voss', 'You know too much now, and so does every badge in the city. Five stars, love.'],
      ['Mara Voss', 'The Ferryman waits at the docks pier. Do not keep him waiting.'],
    ],
    setup(state) {
      state.heat = 500;
      return { phase: 'run', target: { x: 3740, y: 2700 }, timer: 170 };
    },
    update(state, rt, dt) {
      rt.timer -= dt;
      if (rt.timer <= 0) return 'the Ferryman left without you';
      if (dist(state.player, rt.target) < 58) return 'done';
      return null;
    },
    objective(rt) {
      return `Reach the boat at the docks pier — ${Math.max(0, Math.ceil(rt.timer))}s`;
    },
  },
];

/** Attach the mission engine's state to the world state. */
export function initMissions(state) {
  state.mission = { next: 0, active: null, dialog: null, banner: null };
}

/** The world marker the renderer and minimap should show right now, or null. */
export function missionMarker(state) {
  const m = state.mission;
  if (!m) return null;
  if (m.active) {
    const t = m.active.target;
    if (t) return { x: t.x, y: t.y, kind: 'mission', label: '!' };
    return null;
  }
  if (m.next < MISSIONS.length) {
    return { x: PLACES.maraOffice.x, y: PLACES.maraOffice.y, kind: 'office', label: 'M' };
  }
  return null;
}

/** The one-line objective for the HUD. */
export function objectiveText(state) {
  const m = state.mission;
  if (!m) return '';
  if (m.active) return `${MISSIONS[m.active.def].title} — ${MISSIONS[m.active.def].objective(m.active)}`;
  if (m.next < MISSIONS.length) return `See Mara Voss for work — ${MISSIONS[m.next].title}`;
  return 'Free roam — Port Solano is yours';
}

/** Step dialogs, banners and the active mission. `actions` are input action bits. */
export function stepMissions(state, dt, actions) {
  const m = state.mission;
  if (!m || state.over) return;
  if (m.banner) {
    m.banner.t += dt;
    if (m.banner.t > 4) m.banner = null;
  }
  if (m.dialog) {
    m.dialog.t += dt;
    if (m.dialog.t > 3.4 || (actions & 1)) { // ACTION_CONFIRM skips ahead
      m.dialog.i += 1;
      m.dialog.t = 0;
      if (m.dialog.i >= m.dialog.lines.length) m.dialog = null;
    }
    return; // the world keeps moving, the mission waits for the talk to end
  }
  if (!m.active) {
    if (m.next < MISSIONS.length && dist(state.player, PLACES.maraOffice) < 48 && state.player.carId === null) {
      const def = MISSIONS[m.next];
      const rt = def.setup(state);
      rt.def = m.next;
      rt.target = rt.target ?? null;
      m.active = rt;
      say(state, def.intro);
      state.fx.push('missionstart');
    }
    return;
  }
  const def = MISSIONS[m.active.def];
  const result = def.update(state, m.active, dt);
  if (result === 'done') {
    if (def.cleanup) def.cleanup(state, m.active);
    finish(state, m.active);
  } else if (typeof result === 'string') {
    if (def.cleanup) def.cleanup(state, m.active);
    fail(state, result);
  }
}

export { MISSIONS };
