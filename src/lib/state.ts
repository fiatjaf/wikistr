import { writable, type Writable } from 'svelte/store';
import type { Tab } from './types';

export const tabs: Writable<Tab[]> = writable([]);
