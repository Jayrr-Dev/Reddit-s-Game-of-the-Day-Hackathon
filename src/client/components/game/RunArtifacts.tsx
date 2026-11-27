import { getRunArtifact, type RunArtifactId } from '../../../shared/game/hellArtifacts';
import { Glyph } from '../ui/Glyph';

/** Keeps a run's temporary artifacts visible without putting them in permanent storage. */
export function RunArtifacts({ artifacts }: { artifacts?: readonly RunArtifactId[] | undefined }) {
  if (!artifacts?.length) return null;
  return <section className="cs-paper" aria-label="Artifacts for this run">
    <h3>Artifacts <span className="cs-inventory-count">This run</span></h3>
    <ul className="cs-compartment grid gap-2">
      {artifacts.map(id => {
        const artifact = getRunArtifact(id);
        return <li key={id} className="flex items-center gap-2">
          <Glyph name={artifact.icon} className="size-5 shrink-0" />
          <span><strong>{artifact.name}</strong> <small>{artifact.detail}</small></span>
        </li>;
      })}
    </ul>
  </section>;
}
