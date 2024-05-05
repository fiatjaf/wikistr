import { debounce } from 'debounce';
import { readable } from 'svelte/store';
import type { EventTemplate, Event, NostrEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { normalizeURL } from 'nostr-tools/utils';
import type { Relay, Subscription } from 'nostr-tools/relay';

type CancelFunc = () => void;
type HookFunc = (events: Event[]) => void;
type KeyFunc = (event: Event) => string;
type CachingSubscription = {
  cache: Map<string, Event>;
  hook: HookFunc;
  cancel: CancelFunc;
};
export type Metadata = {
  pubkey: string;
  name?: string;
  display_name?: string;
  nip05?: string;
  nip05valid: boolean;
  picture?: string;
};

export const reactionKind = 7;
export const labelKind = 1985;
export const wikiKind = 30818;

const _pool = new SimplePool();
const _subscriptions: Record<string, CachingSubscription> = {};
const _metadataCache = new Map<string, Metadata>();
const _seenOn = new WeakMap<Event, Set<string>>();

export const cachedArticles = new Map<string, Event>();

export const signer = {
  getPublicKey: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubkey = await (window as any).nostr.getPublicKey();
    setUserPreferredRelays(pubkey);
    setAccount(await getMetadata(pubkey));
    return pubkey;
  },
  signEvent: async (event: EventTemplate): Promise<Event> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const se: Event = await (window as any).nostr.signEvent(event);
    setUserPreferredRelays(se.pubkey);
    setAccount(await getMetadata(se.pubkey));
    return se;
  }
};

let setAccount: (_: Metadata) => void;
export const account = readable<Metadata | null>(null, (set) => {
  setAccount = (account: Metadata) => {
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

export const fallbackRelays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.primal.net',
  'wss://relay.nostr.band'
];

export const defaultWriteRelays = ['wss://nostr.mom', 'wss://nostr3.daedaluslabs.io'];
export const relayListsRelays = ['wss://purplepag.es', 'wss://relay.nos.social'];
export const profileRelays = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://purplepag.es'
];

export const safeRelays = [
  'wss://nostr.mom',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr.land',
  'wss://nostr21.com'
];

let setUserPreferredRelays: (_: string) => Promise<void>;
export const userPreferredRelays = readable(
  { read: safeRelays, write: defaultWriteRelays },
  (set) => {
    // TODO: if user logs in, query their preferred relays
    setUserPreferredRelays = async (pubkey: string) => {
      const res = await _pool.querySync([...relayListsRelays, ...fallbackRelays], {
        kinds: [10002, 10102],
        authors: [pubkey]
      });

      let best10002 = { created_at: 0, tags: [] } as Pick<NostrEvent, 'created_at' | 'tags'>;
      let best10102 = { created_at: 0, tags: [] } as Pick<NostrEvent, 'created_at' | 'tags'>;
      for (let i = 0; i < res.length; i++) {
        const event = res[i];
        if (event.kind === 10002 && event.created_at > best10002.created_at) {
          best10002 = event;
        } else if (event.kind === 10102 && event.created_at > best10102.created_at) {
          best10102 = event;
        }
      }

      let write = best10002.tags
        .map((t) => t[0] === 'r' && t[1])
        .filter((r) => r) as unknown as string[];
      if (write.length === 0) write = defaultWriteRelays;

      let read = best10002.tags
        .map((t) => t[0] === 'r' && t[1])
        .filter((r) => r) as unknown as string[];
      read = read.concat(
        best10102.tags.map((t) => t[0] === 'relay' && t[1]).filter((r) => r) as unknown as string[]
      );
      if (read.length === 0) read = safeRelays;

      set({ read, write });
    };
  }
);

export const getA: KeyFunc = (event: Event) => {
  const dTag = event.tags.find(([t, v]) => t === 'd' && v)?.[1] || '';
  return `${event.kind}:${event.pubkey}:${dTag}`;
};

export function getRelaysForEvent(event: Event): Iterable<string> {
  return _seenOn.get(event)?.keys() || [];
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

export function cachingSub(
  name: string,
  relays: string[],
  filter: Filter,
  hook: HookFunc,
  keyfn: KeyFunc = (event: Event) => event.id
): CancelFunc {
  const alreadyHaveEvent =
    filter.kinds?.[0] === wikiKind || filter.ids
      ? (relay: Relay, id: string) => {
          const event = cachedArticles.get(id);
          if (event) {
            // we already have this event, so no need to parse it again
            cacheSeenOn(event, relay.url);

            // if we didn't have this in the cache yet we add it then trigger the hook
            const k = keyfn(event);
            if (!cache.has(k)) {
              cache.set(k, event);
              invokeHook();
            }

            return true;
          }
          return false;
        }
      : undefined;

  const invokeHook = debounce(() => {
    const s = _subscriptions[name];
    if (!s) return;
    const events = Array.from(s.cache.values()).sort((a, b) => b.created_at - a.created_at);
    s.hook(events);
  }, 500);

  if (name in _subscriptions) {
    _subscriptions[name].hook = hook;
    invokeHook();
    return _subscriptions[name].cancel;
  }

  const subs: Subscription[] = [];
  const cancel = () => {
    subs.forEach((s) => {
      s.close();
    });
    delete _subscriptions[name];
  };

  const cache = new Map<string, Event>();
  _subscriptions[name] = { cache, hook, cancel };

  relays.forEach(async (url) => {
    const r = await _pool.ensureRelay(url);
    const subscription = r.prepareSubscription([filter], {
      id: name,
      receivedEvent: alreadyHaveEvent,
      onevent(event) {
        _subscriptions[name]?.cache?.set?.(keyfn(event), event);
        if (event.kind === wikiKind) {
          if (!cachedArticles.has(event.id)) {
            // only set if not already set otherwise we lose the seenOn stuff
            cachedArticles.set(event.id, event);
          }
          cacheSeenOn(event, url);
        }
        invokeHook();
      }
    });
    subscription.fire();
    subs.push(subscription);
  });

  return cancel;
}

function cacheSeenOn(event: Event, relay: string) {
  const relays = _seenOn.get(event) || new Set();
  _seenOn.set(event, relays);
  relays.add(normalizeURL(relay));
}

export async function getMetadata(pubkey: string): Promise<Metadata> {
  const metadata = _metadataCache.get(pubkey);
  if (metadata) return metadata;

  // TODO: use dexie as a second-level cache
  const event = await _pool.get(profileRelays, { kinds: [0], authors: [pubkey] });
  try {
    const metadata = JSON.parse(event!.content);
    metadata.pubkey = pubkey;
    _metadataCache.set(pubkey, metadata);
    return metadata;
  } catch (err) {
    const metadata = { pubkey, nip05valid: false };
    _metadataCache.set(pubkey, metadata);
    return metadata;
  }
  // TODO: validate nip05
}
