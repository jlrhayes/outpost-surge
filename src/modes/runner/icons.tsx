// OWNER: runner agent. Inline SVG icons for the runner (barrel labels, HUD chips, level select).
// Registered into the shared Icon set with an `rn_` prefix so other modules can use them too.
import { registerIcon } from '../../ui/components/Icon';

/** Raw SVG markup (24x24 viewBox) keyed by name; used for imperatively built DOM labels. */
export const RN_SVG: Record<string, string> = {
  soldiers:
    '<path d="M5 10a7 6 0 0 1 14 0v1H5z" fill="#6b8e4e" stroke="#243a1a" stroke-width="1.5"/><rect x="4" y="10" width="16" height="2.4" rx="1" fill="#4f6e38" stroke="#243a1a" stroke-width="1.2"/><path d="M7 13h10l-1 4a4 4 0 0 1-8 0z" fill="#f0c8a0" stroke="#6a4a2a" stroke-width="1.2"/><path d="M4 23c1-4 4-6 8-6s7 2 8 6z" fill="#6b8e4e" stroke="#243a1a" stroke-width="1.5"/>',
  rate: '<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffd23c" stroke="#8a5a00" stroke-width="1.5" stroke-linejoin="round"/>',
  dmg: '<path d="M9 21V9l3-6 3 6v12z" fill="#ffb347" stroke="#7a4a10" stroke-width="1.5" stroke-linejoin="round"/><rect x="8" y="17" width="8" height="4" fill="#c07a20" stroke="#7a4a10" stroke-width="1.2"/>',
  multi:
    '<path d="M3 20V11l2-4 2 4v9zM10 20V8l2-5 2 5v12zM17 20v-9l2-4 2 4v9z" fill="#ffc94a" stroke="#7a4a10" stroke-width="1.3" stroke-linejoin="round"/>',
  tank: '<rect x="3" y="14" width="18" height="6" rx="3" fill="#3d4a2a" stroke="#1a2010" stroke-width="1.4"/><rect x="5" y="10" width="13" height="5" rx="1.5" fill="#6b8e23" stroke="#2a3a10" stroke-width="1.4"/><rect x="8" y="7" width="7" height="4" rx="1" fill="#7aa030" stroke="#2a3a10" stroke-width="1.3"/><rect x="14" y="8" width="8" height="2" fill="#444" stroke="#222" stroke-width="1"/>',
  rocket:
    '<path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z" fill="#e8e8e8" stroke="#555" stroke-width="1.4"/><circle cx="12" cy="9" r="1.8" fill="#3a9cf0"/><path d="M8 13l-3 4 3-1M16 13l3 4-3-1" fill="#d04030" stroke="#7a1a10" stroke-width="1.2"/><path d="M10 17l2 5 2-5" fill="#ff9a2a" stroke="#b05a10" stroke-width="1.1"/>',
  explosive:
    '<path d="M12 2l2.5 5 5-2-2 5 5 2.5-5 2 2 5-5-2L12 22l-2.5-4.5-5 2 2-5L2 12l4.5-2.5-2-5 5 2z" fill="#ff7a2a" stroke="#9a2a00" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="#ffe070"/>',
  skull:
    '<path d="M12 2c5 0 8 3.5 8 8 0 3-1.5 4.5-3 5.5V19h-2v2h-2v-2h-2v2H9v-2H7v-3.5C5.5 14.5 4 13 4 10c0-4.5 3-8 8-8z" fill="#f2efe6" stroke="#3a3a3a" stroke-width="1.4"/><circle cx="8.8" cy="10.5" r="2.2" fill="#3a3a3a"/><circle cx="15.2" cy="10.5" r="2.2" fill="#3a3a3a"/><path d="M11 14l1-2 1 2z" fill="#3a3a3a"/>',
  walker:
    '<circle cx="12" cy="6" r="4" fill="#8fb070" stroke="#3a5a2a" stroke-width="1.4"/><path d="M7 22l1-9h8l1 9z" fill="#6a5a8a" stroke="#2a2440" stroke-width="1.4"/><path d="M8 13l-4 2M16 13l5 1" stroke="#8fb070" stroke-width="2.4" stroke-linecap="round"/>',
  runner:
    '<circle cx="15" cy="4.5" r="3" fill="#9aa68a" stroke="#3a4a2a" stroke-width="1.3"/><path d="M13 8l-4 6 4 1-2 7M13 8l3 6 4 1M12 11l-5-1" stroke="#8a5a3a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  brute:
    '<circle cx="12" cy="5.5" r="3.5" fill="#6f8f4f" stroke="#2f4a1f" stroke-width="1.4"/><path d="M3 22l1-10c1-2 3-3 8-3s7 1 8 3l1 10z" fill="#5a4a7a" stroke="#241a3a" stroke-width="1.4"/><path d="M4 12l-2 6M20 12l2 6" stroke="#6f8f4f" stroke-width="3" stroke-linecap="round"/>',
  elite:
    '<circle cx="12" cy="7" r="4" fill="#b06a6a" stroke="#5a2020" stroke-width="1.4"/><path d="M7 22l1-9h8l1 9z" fill="#5a2a4a" stroke="#2a1020" stroke-width="1.4"/><path d="M8 3l2 2 2-3 2 3 2-2" stroke="#ffcf3a" stroke-width="1.6" fill="none"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" fill="#ffcf3a" stroke="#a07000" stroke-width="1.4" stroke-linejoin="round"/>',
  starEmpty: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" fill="#28384a" stroke="#0e1822" stroke-width="1.4" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2" fill="#c8ccd4" stroke="#4a4e56" stroke-width="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#4a4e56" stroke-width="2"/><circle cx="12" cy="15" r="1.6" fill="#4a4e56"/>',
  ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" fill="#ffcf3a" stroke="#9a6a00" stroke-width="1.4"/><path d="M9 7v10" stroke="#9a6a00" stroke-dasharray="2 1.5"/><path d="M14 9.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z" fill="#fff"/>',
  speed: '<circle cx="12" cy="13" r="8" fill="#fff" stroke="#3a9cf0" stroke-width="2"/><path d="M12 8v5l3 2" stroke="#1a5fa8" stroke-width="2" fill="none"/><path d="M9 2h6" stroke="#3a9cf0" stroke-width="2.4"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1.2" fill="#fff"/><rect x="14" y="4" width="4" height="16" rx="1.2" fill="#fff"/>',
  hand: '<path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10l.5-.2V8a1.5 1.5 0 0 1 3 0v2.3a1.5 1.5 0 0 1 3 .2v5.5c0 3.5-2.5 6-6 6h-1c-2 0-3.5-1-4.5-2.6L4.4 14a1.5 1.5 0 0 1 2.4-1.8L9 14.5z" fill="#fff" stroke="#233" stroke-width="1.2" stroke-linejoin="round"/>',
};

export function svg(name: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${RN_SVG[name] ?? ''}</svg>`;
}

/** Register runner icons for <Icon name="rn_xxx" />. Safe to call more than once. */
export function registerRunnerIcons(): void {
  for (const [name, body] of Object.entries(RN_SVG)) {
    registerIcon('rn_' + name, (s) => <svg width={s} height={s} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: body }} />);
  }
}
