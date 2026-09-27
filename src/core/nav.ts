// Navigation: which 3D mode is active, which overlay screens are open, and toasts.
//
//   goTo('runner', { level: 3 });            // switch 3D mode (base | world | runner | battle)
//   openScreen('heroes');                    // push an overlay screen by registry id
//   openScreen('buildingPanel', { uid });    // with props
//   closeScreen();                           // pop the top screen
//   toast('Not enough food');                // transient message
import { signal } from '@preact/signals';
import type { ModeId } from './types';
import { emit } from './events';

export interface Route {
  mode: ModeId;
  params?: any;
}

export interface ScreenEntry {
  key: number;
  id: string;
  props?: any;
}

export const route = signal<Route>({ mode: 'base' });
export const screens = signal<ScreenEntry[]>([]);

let screenKey = 0;

export function goTo(mode: ModeId, params?: any): void {
  screens.value = [];
  route.value = { mode, params };
}

export function openScreen(id: string, props?: any): void {
  screens.value = [...screens.value, { key: ++screenKey, id, props }];
  emit('ui:screenOpened', { id });
}

/** Closes the top-most screen (or a specific one by key). */
export function closeScreen(key?: number): void {
  if (key === undefined) screens.value = screens.value.slice(0, -1);
  else screens.value = screens.value.filter((s) => s.key !== key);
}

export function closeAllScreens(): void {
  screens.value = [];
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad';
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t = { id: ++toastId, text, kind };
  toasts.value = [...toasts.value.slice(-3), t];
  setTimeout(() => {
    toasts.value = toasts.value.filter((x) => x.id !== t.id);
  }, 2200);
}

/**
 * Ask the base scene to pan to (and highlight) a building — used by quest "Go" buttons and
 * requirement links. Switches to the base mode if needed. The base mode watches `baseFocus`.
 */
export interface BaseFocusRequest {
  uid?: string;
  /** Focus the best building of this type (or an empty plot where it can be built if none exists). */
  type?: import('./types').BuildingType;
  /** Also open the building panel after focusing. */
  openPanel?: boolean;
  /** Unique stamp so repeated requests re-trigger. */
  t: number;
}
export const baseFocus = signal<BaseFocusRequest | null>(null);

export function focusBuilding(req: Omit<BaseFocusRequest, 't'>): void {
  if (route.value.mode !== 'base') goTo('base');
  else screens.value = [];
  baseFocus.value = { ...req, t: Date.now() };
}
