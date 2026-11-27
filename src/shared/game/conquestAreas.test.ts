import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeRows, formUp } from './battlefield.ts';
import { createHeroUnit } from './combat.ts';
import { ARCHANGEL_BOSSES, AREA_BOSSES, areaCounts, areaRoomEvent, buildAreaBattles, CAMPAIGN_LENGTH, CONQUEST_VERSION, conquestStops, GRANDANGEL_BOSSES, LOCATION_BOSSES, MAX_WAVE_SIZE } from './conquestAreas.ts';
import { CONQUEST_SCENARIOS } from './conquestScenarios.ts';
import { CHAMPION_IDS, getHero } from './heroes.ts';
import { canChooseRegion } from './regionRoutes.ts';
import { PLAYER_HP_CAP, STOPS_PER_REGION } from './rules.ts';
import { createRun, isRunOver, optionsFor, runReducer, type RunState } from './run.ts';
import { groupUnitsByUnitType, unitRankGroups, unitRankLabel } from './sandbox.ts';
import { replayForScoreAndUnlocks } from './replayForScore.ts';
import { restoreLoggedRun, saveLoggedRun } from './runSave.ts';

const DAY = 'campaign-test';
function campaign() {
  return createRun(DAY, undefined, 0, 0, [], undefined, undefined, undefined, false, CONQUEST_VERSION);
}

function routeAt(stop: number): RunState {
  return { ...campaign(), stop, phase: { kind: 'route', options: conquestStops(DAY, stop) } };
}

/** Bring a controlled winning hit through the real reducer. */
function clearWave(run: RunState): RunState {
  assert.equal(run.phase.kind, 'combat');
  const combat = run.phase.combat;
  const last = combat.heroes[0]!;
  const hero = createHeroUnit(last.heroId === 'cervielSword' ? 'squire' : last.heroId, last.uid, 1);
  const target = { ...hero, ...(hero.heroId === 'archangelMikhael' && { phase: 2 as const }), hp: 1, guard: 0, statuses: { ...hero.statuses, armor: 0 }, row: 'front' as const, col: 1 };
  const ready: RunState = { ...run, phase: { ...run.phase, combat: { ...combat, heroes: [target], energy: 5, hand: ['backhand'] } } };
  return runReducer(ready, { type: 'playCard', handIndex: 0, targetUid: target.uid });
}

function clearBattle(run: RunState): RunState {
  let next = run;
  for (let wave = 0; wave < 3 && next.phase.kind === 'combat'; wave++) {
    next = clearWave(next);
    if (next.area?.wavePending) next = runReducer(next, { type: 'nextBattleWave' });
  }
  assert.ok(next.phase.kind === 'reward' || next.phase.kind === 'sealing');
  return next;
}

void test('hand-authored waves have at most six units and valid non-overlapping entry positions', () => {
  for (const scenario of Object.values(CONQUEST_SCENARIOS)) {
    assert.ok(scenario.heroIds.length > 0 && scenario.heroIds.length <= MAX_WAVE_SIZE, scenario.name);
    const spawned = formUp(scenario.heroIds.map((id, i) => createHeroUnit(id, i + 1, 1)), 'furthest');
    assert.equal(new Set(spawned.map(unit => unit.row + ':' + unit.col)).size, spawned.length, scenario.name);
  }
});

void test('reinforcements march in from the back with the same hand, player, and battle clock; no reward for a wave', () => {
  const initial = runReducer(campaign(), { type: 'chooseStop', option: 0 });
  assert.equal(initial.phase.kind, 'combat');
  assert.equal(initial.phase.combat.heroes[0]?.row, activeRows().at(-1));
  const advanced = runReducer(initial, { type: 'endTurn' });
  assert.equal(advanced.phase.kind, 'combat');
  assert.equal(advanced.phase.combat.player.hp, initial.phase.combat.player.hp);
  assert.notEqual(advanced.phase.combat.heroes[0]?.row, initial.phase.combat.heroes[0]?.row);
  const pending = clearWave(advanced);
  assert.equal(pending.phase.kind, 'combat');
  assert.equal(pending.area?.wavePending, true);
  assert.equal(pending.goldVictories.length, 0);
  assert.equal(runReducer(pending, { type: 'pickCard', offerIndex: null }), pending);
  const next = runReducer(pending, { type: 'nextBattleWave' });
  assert.equal(next.phase.kind, 'combat');
  assert.equal(next.phase.combat.player, pending.phase.combat.player);
  assert.equal(next.phase.combat.hand, pending.phase.combat.hand);
  assert.equal(next.phase.combat.turn, pending.phase.combat.turn);
  const nextUid = pending.phase.combat.nextUid;
  assert.ok(next.phase.combat.heroes.every(unit => unit.uid >= nextUid));
  assert.equal(runReducer(next, { type: 'nextBattleWave' }), next);
  const won = clearWave(next);
  assert.equal(won.phase.kind, 'reward');
  assert.equal(won.goldVictories.length, 1);
  assert.equal(won.stats.wavesCleared, 2);
});

void test('large locations have two battles, room and secret counts, and an exclusive rest choice', () => {
  const first = runReducer(routeAt(4), { type: 'chooseStop', option: 1 });
  assert.equal(first.area?.site.name, 'Basilica Ward');
  assert.deepEqual(areaCounts(first.area!.site), { battles: 2, rooms: 5 });
  const reward = clearBattle(first);
  const camp = runReducer({ ...reward, hp: 20 }, { type: 'pickCard', offerIndex: null });
  assert.equal(camp.phase.kind, 'area-camp');
  const explored = runReducer(camp, { type: 'areaCamp', choice: 'explore' });
  assert.equal(explored.phase.kind, 'area-camp');
  assert.equal(explored.phase.explored, 1);
  assert.equal(runReducer(explored, { type: 'areaCamp', choice: 'rest' }), explored);
  const rested = runReducer(camp, { type: 'areaCamp', choice: 'rest' });
  assert.equal(rested.phase.kind, 'combat');
  assert.ok(rested.hp > camp.hp);
  assert.equal(rested.area?.battle, 1);
  assert.equal(rested.area?.site.map, first.area?.site.map);
  const bossWin = clearBattle(rested);
  assert.equal(bossWin.stats.regionsConquered, 0);
  assert.deepEqual(bossWin.goldVictories.map(v => [v.encounter, v.battle]), [['elite', 0], ['champion', 1]]);
});

void test('each of the nine capitals has one distinct region guardian, and only the last grants victory', () => {
  assert.equal(CAMPAIGN_LENGTH, 9);
  const guardians = [...GRANDANGEL_BOSSES, ...ARCHANGEL_BOSSES];
  assert.equal(new Set(guardians).size, 9);
  for (let index = 0; index < guardians.length; index++) {
    const stop = (index + 1) * STOPS_PER_REGION;
    const site = conquestStops(DAY, stop, 1)[0]?.site;
    assert.equal(site?.kind, 'capital');
    const plan = buildAreaBattles(site!, DAY, stop, 0);
    const wave = plan.at(-1)?.waves.at(-1);
    assert.equal(wave?.heroIds[0], guardians[index]);
    assert.equal(plan.at(-1)?.finish, 'region-boss');
    assert.equal(wave?.name, index < GRANDANGEL_BOSSES.length ? 'Region Boss' : 'Final Boss');
  }
  const penultimate = runReducer(routeAt(40), { type: 'chooseStop', option: 0 });
  const final = runReducer(routeAt(45), { type: 'chooseStop', option: 0 });
  for (const start of [penultimate, final]) {
    const before = { ...start, stats: { ...start.stats, regionsConquered: Math.floor(start.stop / 5) - 1 } };
    const claim = (won: RunState) => runReducer(won, { type: 'pickCard', offerIndex: null });
    const proceed = (run: RunState) => runReducer(run, { type: 'areaCamp', choice: 'continue' });
    const halfway = clearBattle(before);
    assert.equal(halfway.stats.regionsConquered, before.stats.regionsConquered, 'capital guard is not the region boss');
    const won = clearBattle(proceed(claim(halfway)));
    assert.equal(won.stats.regionsConquered, before.stats.regionsConquered + 1);
    assert.equal(isRunOver(won), false);
    const isFinale = start.stop === 45;
    if (isFinale) {
      assert.equal(won.phase.kind, 'sealing');
      assert.equal(runReducer(won, { type: 'abandon' }), won);
      assert.equal(runReducer(won, { type: 'finishSealing' }).phase.kind, 'conquered');
    } else {
      const next = proceed(claim(won));
      assert.equal(isRunOver(next), false);
      assert.equal(canChooseRegion(next), true);
      assert.equal(runReducer(next, { type: 'chooseStop', option: 0 }), next);
    }
  }
});

void test('City Bosses, optional dragon Area Bosses, and hidden room outcomes are distinct', () => {
  const seen = new Set<string>();
  for (let stop = 1; stop <= CAMPAIGN_LENGTH * STOPS_PER_REGION; stop++) {
    for (const key of [DAY, 'draw-2', 'draw-3', 'draw-4', 'draw-5']) {
      const sites = conquestStops(key, stop, 1);
      for (const { site } of sites) {
        assert.ok(site);
        const plan = buildAreaBattles(site, key, stop, 0);
        if (site.cityBoss) {
          assert.equal(plan.at(-1)?.waves.at(-1)?.heroIds[0], site.cityBoss);
          assert.equal(plan.at(-1)?.finish, 'location-boss');
          seen.add(site.cityBoss);
        }
        if (site.dragon) {
          assert.equal(plan[0]?.finish, 'dragon-boss');
          assert.equal(sites[0]?.site?.dragon, undefined);
          assert.ok((AREA_BOSSES as readonly string[]).includes(site.dragon));
        }
        plan.forEach((battle, index) => {
          const events = Array.from({ length: battle.rooms }, (_, room) => areaRoomEvent(key, stop, site, index, battle, room, false));
          assert.equal(events.filter(event => event.secret).length, battle.secrets);
        });
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...LOCATION_BOSSES].sort());
});

void test('both roads in every region have a distinct guarded city before the capital', () => {
  for (let region = 0; region < CAMPAIGN_LENGTH; region++) {
    const capital = (region + 1) * STOPS_PER_REGION;
    const stop = capital - 1;
    for (const route of [0, 1] as const) {
      const cities = conquestStops(DAY, stop, route);
      assert.equal(cities.length, 2);
      assert.notEqual(cities[0]?.site?.name, cities[1]?.site?.name);
      assert.notEqual(cities[0]?.site?.cityBoss, cities[1]?.site?.cityBoss);
      for (const [option, city] of cities.entries()) {
        assert.equal(city.site?.kind, 'city');
        assert.ok(city.site?.cityBoss);
        const battle = buildAreaBattles(city.site, DAY, stop, option).at(-1);
        assert.equal(battle?.finish, 'location-boss');
        assert.equal(battle?.waves.at(-1)?.heroIds[0], city.site.cityBoss);
      }
      assert.equal(conquestStops(DAY, capital, route)[0]?.site?.kind, 'capital');
    }
  }
});

void test('Light Lord Mori closes Penitent Court with both retainers', () => {
  const stop = 6 * STOPS_PER_REGION + 4;
  const site = conquestStops(DAY, stop)[1]?.site;
  assert.equal(site?.name, 'Penitent Court');
  assert.equal(site?.cityBoss, 'lightLordMori');
  assert.ok(site);
  const battle = buildAreaBattles(site, DAY, stop, 1).at(-1);
  assert.equal(battle?.finish, 'location-boss');
  assert.deepEqual(battle?.waves.at(-1)?.heroIds, ['lightLordMori', 'paladin', 'hornedSentinel']);
});

void test('the Training roster exposes two grouping layers and late-game HP and attack scale', () => {
  const groups = groupUnitsByUnitType();
  const summons = groups.find(group => group.id === 'summons');
  assert.deepEqual(new Set(summons?.heroIds), new Set(['grandangelCerviel', 'cervielBow', 'zeruelRedSun', 'zeruelBlueSun']));
  for (const group of groups) assert.equal(unitRankGroups(group.heroIds).flatMap(rank => rank.heroIds).length, group.heroIds.length);
  assert.equal(unitRankLabel('angelAssassin'), 'Grunt');
  assert.equal(unitRankLabel('lightLordMori'), 'City Boss');
  assert.equal(unitRankLabel('ballista'), 'Elite');
  assert.equal(getHero('ballista').maxHp, 100);
  for (const id of CHAMPION_IDS) assert.equal(unitRankLabel(id), 'Officer');
  assert.deepEqual(ARCHANGEL_BOSSES.map(id => getHero(id).maxHp), [1000, 1500, 2000]);
  for (const id of ARCHANGEL_BOSSES) {
    assert.equal(unitRankLabel(id), 'Final Boss');
    const attacks = getHero(id).moves.map(move => move.effects.reduce((damage, effect) => damage + (effect.kind === 'attack' ? effect.amount * effect.hits : 0), 0));
    assert.ok(Math.max(...attacks) >= 60 && Math.max(...attacks) <= PLAYER_HP_CAP * 0.25);
  }
});

void test('v1 action logs and v2 profiles replay with their own immutable route options', () => {
  const originalGuardians = ['holyKing', 'grandGriffon', 'mageBorneAzula', 'twinAxeKnight', 'mageBorneAstra', 'holyDragon', 'lightLordMori'];
  const actions = [{ type: 'chooseStop', option: 0 }] as const;
  const map = new Map<string, string>();
  const storage = { get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  for (const conquestVersion of [1, CONQUEST_VERSION] as const) {
    const profile = { id: 'version-' + conquestVersion, wins: 0, cardRules: 1, progressionVersion: 2, conquestVersion, xpStartWins: 0 } as const;
    const fresh = createRun(DAY, undefined, 0, 0, [], undefined, 1, undefined, false, conquestVersion, 0);
    const run = runReducer(fresh, actions[0]);
    for (const savedProfile of [undefined, profile]) {
      saveLoggedRun({ run, actions: [...actions], attempt: 0, initialRings: fresh.character.ringProgress, ...(savedProfile && { profile: savedProfile }) }, storage);
      const restored = restoreLoggedRun(DAY, storage);
      assert.deepEqual(restored.run, run);
      assert.equal(restored.profile?.conquestVersion, savedProfile?.conquestVersion);
    }
    const ranked = replayForScoreAndUnlocks(DAY, actions, 0, [], undefined, 1, undefined, false, conquestVersion, 0).state;
    assert.equal(ranked.conquestVersion, conquestVersion);
    for (let region = 0; region < CAMPAIGN_LENGTH; region++) {
      const stop = (region + 1) * STOPS_PER_REGION - 1;
      const [left, right] = optionsFor(ranked, stop);
      if (conquestVersion === 1) {
        assert.equal(left?.site?.cityBoss, undefined);
        assert.equal(right?.site?.cityBoss, originalGuardians[region]);
      } else {
        assert.ok(left?.site?.cityBoss);
        assert.ok(right?.site?.cityBoss);
      }
    }
  }
  assert.equal(runReducer(createRun(DAY), actions[0]).area, undefined);
});
