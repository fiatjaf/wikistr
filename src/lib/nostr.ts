import { readable } from 'svelte/store';
import * as idbkv from 'idb-keyval';
import type { EventTemplate, Event } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { loadNostrUser, type NostrUser } from './metadata';
import { DEFAULT_WIKI_RELAYS } from './defaults';
import { loadContactList, loadWikiAuthors, loadWikiRelaysList } from './lists';
import { unique } from './utils';

const startTime = Math.round(Date.now() / 1000);

export const reactionKind = 7;
export const wikiKind = 30818;

export const _pool = new SimplePool();

export const signer = {
  getPublicKey: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubkey = await (window as any).nostr.getPublicKey();
    setAccount(pubkey);
    return pubkey;
  },
  signEvent: async (event: EventTemplate): Promise<Event> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const se: Event = await (window as any).nostr.signEvent(event);
    setAccount(se.pubkey);
    return se;
  }
};

let setUserWikiRelays: (_: string) => Promise<void>;
export const userWikiRelays = readable<string[]>(DEFAULT_WIKI_RELAYS, (set) => {
  setUserWikiRelays = async (pubkey: string) => {
    const rl = unique(await loadWikiRelaysList(pubkey));
    if (rl.length > 0) {
      set(rl);
    }
  };
});

let setWOT: (_: string) => Promise<void>;
export const wot = readable<{ [pubkey: string]: number }>({}, (set) => {
  setWOT = async (pubkey) => {
    const cached = await idbkv.get('wikistr:wot');
    if (cached && cached.when > startTime - 7 * 24 * 60 * 60) {
      set(cached.scoremap);
      return;
    }

    const scoremap: { [pubkey: string]: number } = {};
    await Promise.all([
      recurse(loadContactList, 10, pubkey, 30),
      recurse(loadWikiAuthors, 6, pubkey, 30)
    ]);
    idbkv.set(`wikistr:wot`, { when: startTime, scoremap });
    set(scoremap);

    async function recurse(
      fetch: (srcpk: string) => Promise<string[]>,
      degrade: number,
      src: string,
      score: number
    ) {
      scoremap[src] = (scoremap[src] || 0) + score;

      if (score <= degrade) return;

      const nextkeys = await fetch(src);
      await Promise.all(
        nextkeys.map(async (next) => {
          return recurse(fetch, degrade, next, score - degrade);
        })
      );
    }
  };
});

let setAccount: (_: string) => Promise<void>;
export const account = readable<NostrUser | null>(null, (set) => {
  setAccount = async (pubkey: string) => {
    const account = await loadNostrUser(pubkey);
    idbkv.set('wikistr:loggedin', account);
    set(account);
  };

  // try to load account from local storage on startup
  setTimeout(async () => {
    const data = await idbkv.get('wikistr:loggedin');
    if (data) set(data);
  }, 700);
});

const unsub = account.subscribe((account) => {
  if (account) {
    setTimeout(() => {
      setUserWikiRelays(account.pubkey);
      setWOT(account.pubkey);
      unsub();
    }, 300);
  }
});

// ensure these subscriptions are always on
account.subscribe(() => {});
wot.subscribe(() => {});
userWikiRelays.subscribe(() => {});

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
