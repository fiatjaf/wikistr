import { writable, type Writable } from 'svelte/store';

import type { Tab } from './types';

export const tabs: Writable<Tab[]> = writable([]);

// use this global store because we must prevent scrollTabIntoView from happening whenever we're dragging the main panel
export const mainPanelDragging = writable(false);
