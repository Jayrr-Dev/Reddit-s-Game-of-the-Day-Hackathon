import {
  defaultBuild,
  isPlayerBuild,
  type PlayerBuild,
} from '../../shared/game/playerBuild';
const key = (id?: string) => 'villain-run:build:' + (id ?? 'guest');
export function localBuild(id?: string): PlayerBuild {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key(id)) ?? 'null');
    if (isPlayerBuild(data)) return data;
  } catch {}
  return defaultBuild();
}
export function storeBuild(build: PlayerBuild, id?: string) {
  localStorage.setItem(key(id), JSON.stringify(build));
}
