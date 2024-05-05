import { readable } from 'svelte/store';
import type { EventTemplate, Event, NostrEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { loadNostrUser, type NostrUser } from './metadata';
import { DEFAULT_FALLBACK_RELAYS } from './defaults';
import { loadRelayList } from './lists';

export const reactionKind = 7;
export const wikiKind = 30818;

export const _pool = new SimplePool();

export const signer = {
  getPublicKey: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubkey = await (window as any).nostr.getPublicKey();
    setUserPreferredRelays(pubkey);
    setAccount(pubkey);
    return pubkey;
  },
  signEvent: async (event: EventTemplate): Promise<Event> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const se: Event = await (window as any).nostr.signEvent(event);
    setUserPreferredRelays(se.pubkey);
    setAccount(se.pubkey);
    return se;
  }
};

let setAccount: (_: string) => Promise<void>;
export const account = readable<NostrUser | null>(null, (set) => {
  setAccount = async (pubkey: string) => {
    const account = await loadNostrUser(pubkey);
    localStorage.setItem('loggedin', JSON.stringify(account));
    set(account);
  };

  // try to load account from localStorage on startup
  const data = localStorage.getItem('loggedin');
  try {
    set(JSON.parse(data || ''));
  } catch (err) {
    /***/
  }
});

let setUserPreferredRelays: (_: string) => Promise<void>;
export const userPreferredRelays = readable(
  { read: DEFAULT_FALLBACK_RELAYS, write: DEFAULT_FALLBACK_RELAYS },
  (set) => {
    setUserPreferredRelays = async (pubkey: string) => {
      const rl = await loadRelayList(pubkey);
      if (rl.length > 0) {
        set({
          read: rl.filter((ri) => ri.read).map((ri) => ri.url),
          write: rl.filter((ri) => ri.write).map((ri) => ri.url)
        });
      }
    };
  }
);

export function getRelaysForEvent(event: Event): Array<string> {
  return Array.from(_pool.seenOn.get(event.id)?.values() || []).map((x) => x.url);
}

export async function broadcast(
  unsignedEvent: EventTemplate,
  relays: string[]
): Promise<{ event?: Event; successes: string[]; failures: string[]; error?: string }> {
  const successes: string[] = [];
  const failures: string[] = [];
  let error: string | undefined;

  let event: Event;
  try {
    event = await signer.signEvent(unsignedEvent);
  } catch (err) {
    error = String(err);
    return { event: undefined, successes, failures, error };
  }

  await Promise.all(
    relays.map(async (url) => {
      try {
        const r = await _pool.ensureRelay(url);
        await r.publish(event);
        successes.push(url);
      } catch (err) {
        console.warn('failed to publish', event, 'to', url, err);
        failures.push(url);
        error = String(err);
      }
    })
  );

  return { event, successes, failures, error };
}

export function getTagOr(event: NostrEvent, tagName: string, dflt: string = '') {
  return event.tags.find(([t]) => t === tagName)?.[1] || dflt;
}

export function isHex32(input: string): boolean {
  return Boolean(input.match(/^[a-f0-9]{64}$/));
}

export function isATag(input: string): boolean {
  return Boolean(input.match(/^\d+:[0-9a-f]{64}:[^:]+$/));
}
