import { debounce } from 'debounce';
import {
  relayInit,
  utils,
  type EventTemplate,
  type Sub,
  type Relay,
  type Event,
  type Filter
} from 'nostr-tools';
import { readable } from 'svelte/store';

type CancelFunc = () => void;
type HookFunc = (events: Event[]) => void;
type KeyFunc = (event: Event) => string;
type Subscription = {
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

const _conn: Record<string, Relay> = {};
const _subscriptions: Record<string, Subscription> = {};
const _metadataCache = new Map<string, Metadata>();
const _seenOn = new WeakMap<Event, Set<string>>();

export const cachedArticles = new Map<string, Event>();

export const signer = {
  getPublicKey: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubkey = await (window as any).nostr.getPublicKey();
    setAccount(await getMetadata(pubkey));
    return pubkey;
  },
  signEvent: async (event: EventTemplate): Promise<Event> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const se: Event = await (window as any).nostr.signEvent(event);
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

export const fallback = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.primal.net',
  'wss://relay.nostr.band'
];

export const relayLists = ['wss://purplepag.es'];

export const profiles = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://purplepag.es'];

export const safeRelays = [
  'wss://nostr.mom',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://atlas.nostr.land'
];

export const userPreferredRelays = readable(safeRelays, (set) => {
  // TODO: if user logs in, query their preferred relays
  set(safeRelays);
});

export const getA: KeyFunc = (event: Event) => {
  const dTag = event.tags.find(([t, v]) => t === 'd' && v)?.[1] || '';
  return `${event.kind}:${event.pubkey}:${dTag}`;
};

async function ensureRelay(url: string): Promise<Relay> {
  const nm = utils.normalizeURL(url);

  if (!_conn[nm]) {
    _conn[nm] = relayInit(nm, {
      getTimeout: 3000,
      listTimeout: 5000
    });
  }

  const relay = _conn[nm];
  await relay.connect();
  return relay;
}

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
        const r = await ensureRelay(url);
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

  const subs: Sub[] = [];
  const cancel = () => {
    subs.forEach((s) => {
      s.unsub();
    });
    delete _subscriptions[name];
  };

  const cache = new Map<string, Event>();
  _subscriptions[name] = { cache, hook, cancel };

  relays.forEach(async (url) => {
    const r = await ensureRelay(url);
    const subscription = r.sub([filter], {
      id: name,
      alreadyHaveEvent: (id, relay) => {
        const event = cachedArticles.get(id);
        if (event) {
          // we already have this event, so no need to parse it again
          cacheSeenOn(event, relay);

          // if we didn't have this in the cache yet we add it then trigger the hook
          const k = keyfn(event);
          if (!cache.has(k)) {
            cache.set(k, event);
            invokeHook();
          }

          return true;
        }
        return false;
      },
      skipVerification: true
    });
    subs.push(subscription);

    subscription.on('event', (event) => {
      _subscriptions[name]?.cache?.set?.(keyfn(event), event);
      if (event.kind === wikiKind) {
        if (!cachedArticles.has(event.id)) {
          // only set if not already set otherwise we lose the seenOn stuff
          cachedArticles.set(event.id, event);
        }
        cacheSeenOn(event, url);
      }
      invokeHook();
    });
  });

  return cancel;
}

function cacheSeenOn(event: Event, relay: string) {
  const relays = _seenOn.get(event) || new Set();
  _seenOn.set(event, relays);
  relays.add(utils.normalizeURL(relay));
}

export async function getMetadata(pubkey: string): Promise<Metadata> {
  let metadata = _metadataCache.get(pubkey);
  if (metadata) return metadata;

  // TODO: use dexie as a second-level cache

  metadata = await new Promise<Metadata>((resolve) => {
    let ongoing = profiles.length;
    profiles.forEach(async (url) => {
      const r = await ensureRelay(url);
      const event = await r.get({ kinds: [0], authors: [pubkey] });
      if (event) {
        try {
          const metadata = JSON.parse(event.content);
          metadata.pubkey = pubkey;
          resolve(metadata);
        } catch (err) {
          ongoing--;
          if (ongoing === 0) {
            resolve({ pubkey, nip05valid: false });
          }
        }
      }
    });
  });

  // TODO: validate nip05

  _metadataCache.set(pubkey, metadata);
  return metadata;
}
