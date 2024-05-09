import { writable, type Writable } from 'svelte/store';

import type { Card } from './types';

export const cards: Writable<Card[]> = writable([]);
