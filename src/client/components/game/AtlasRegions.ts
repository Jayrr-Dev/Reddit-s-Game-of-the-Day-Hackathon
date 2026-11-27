import { ARCHANGEL_BOSSES, GRANDANGEL_BOSSES } from '../../../shared/game/conquestAreas';

type RegionBoss = (typeof GRANDANGEL_BOSSES | typeof ARCHANGEL_BOSSES)[number];
type AtlasRegion = {
  name: string;
  angel: string;
  landmark: string;
  terrain: 'eclipse' | 'glacier' | 'woods' | 'sanctum' | 'badlands' | 'stars' | 'dunes' | 'twins' | 'summit';
  land: [string, string];
  sea: string;
  ink: string;
  accent: string;
};

const REGIONS: Record<RegionBoss, AtlasRegion> = {
  grandangelCambiel: { name: 'Gilded Lowlands', angel: 'Grandangel Cambiel', landmark: 'Gilded Eclipse', terrain: 'eclipse', land: ['#f6e0a7', '#ba8d53'], sea: '#879a7d', ink: '#765338', accent: '#e7b760' },
  grandangelGeonosis: { name: 'Glacier March', angel: 'Grandangel Geonosis', landmark: 'Glacier Chapel', terrain: 'glacier', land: ['#e5f0e9', '#9cbac2'], sea: '#567785', ink: '#456373', accent: '#f5fffd' },
  grandangelRaziel: { name: 'Veiled Wilds', angel: 'Grandangel Raziel', landmark: 'Veiled Scriptorium', terrain: 'woods', land: ['#e1e6af', '#8fa984'], sea: '#537871', ink: '#3c5c4e', accent: '#bfd3a5' },
  cervielSword: { name: 'Threefold Reach', angel: 'Grandangel Cerviel', landmark: 'Threefold Sanctum', terrain: 'sanctum', land: ['#f8e3c7', '#bca194'], sea: '#846f72', ink: '#704b55', accent: '#f9d9bb' },
  zadkielOfDominations: { name: 'Dominion Escarpment', angel: 'Grandangel Zadkiel', landmark: 'Dominion Hall', terrain: 'badlands', land: ['#ebc49f', '#b48173'], sea: '#735a65', ink: '#693b43', accent: '#efaa80' },
  grandangelCherubiel: { name: 'Astral Highlands', angel: 'Grandangel Cherubiel', landmark: 'Constellation Vault', terrain: 'stars', land: ['#dbe0ef', '#a9abd0'], sea: '#545273', ink: '#554b74', accent: '#fff3c5' },
  archangelUriel: { name: 'Dawnfire Basin', angel: 'Archangel Uriel', landmark: 'Dawnfire Basilica', terrain: 'dunes', land: ['#fff0bb', '#d58e55'], sea: '#ad6653', ink: '#8c4933', accent: '#ffdf88' },
  archangelZeruel: { name: 'Twin Eclipse Range', angel: 'Archangel Zeruel', landmark: 'Twin Eclipse Citadel', terrain: 'twins', land: ['#dfdff1', '#9c9dba'], sea: '#454761', ink: '#454463', accent: '#edcfc4' },
  archangelMikhael: { name: 'World Summit', angel: 'Archangel Mikhael', landmark: 'Gate to Purgatory', terrain: 'summit', land: ['#faf0d6', '#a9b3bf'], sea: '#68778c', ink: '#4e536e', accent: '#fff0ba' },
};

export const ATLAS_REGIONS = [...GRANDANGEL_BOSSES, ...ARCHANGEL_BOSSES].map(boss => REGIONS[boss]);
