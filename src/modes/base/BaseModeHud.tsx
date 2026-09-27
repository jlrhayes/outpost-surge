// Base mode UI = world-space overlay (base agent) underneath the main HUD (meta agent).
import { BaseOverlay } from './BaseOverlay';
import { BaseHud } from '../../ui/hud/BaseHud';

export function BaseModeHud() {
  return (
    <>
      <BaseOverlay />
      <BaseHud />
    </>
  );
}
