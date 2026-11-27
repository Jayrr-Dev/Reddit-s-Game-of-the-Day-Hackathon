export const HELL_ARTIFACTS = [
  { id: 'ember-heart', name: 'Ember Heart', detail: '+10 max HP, up to the health cap.', icon: 'heart', color: '#ee9174' },
  { id: 'bone-sigil', name: 'Bone Sigil', detail: 'Add Bone Ward to your deck.', icon: 'aegis', color: '#e5c48f', card: 'boneWard' },
  { id: 'ashen-vial', name: 'Ashen Vial', detail: 'Add Antidote to your deck.', icon: 'flask', color: '#b4cd8f', card: 'antidote' },
] as const;

export type HellArtifactId = (typeof HELL_ARTIFACTS)[number]['id'];
export type RunArtifactId = HellArtifactId;
export type RunArtifact = (typeof HELL_ARTIFACTS)[number] & { kind: 'artifact'; duration: 'run' };

/** Artifact definitions live outside permanent items and the Album. */
export function getRunArtifact(id: RunArtifactId): RunArtifact {
  const artifact = HELL_ARTIFACTS.find(entry => entry.id === id)!;
  return { ...artifact, kind: 'artifact', duration: 'run' };
}

export const isHellArtifact = (value: unknown): value is HellArtifactId =>
  HELL_ARTIFACTS.some(artifact => artifact.id === value);
