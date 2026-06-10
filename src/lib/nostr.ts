import { derived, readable } from 'svelte/store';
import * as idbkv from 'idb-keyval';

import type { EventTemplate, Event } from '@nostr/tools/pure';
import { DEFAULT_WIKI_RELAYS } from './defaults';
import { unique } from './utils';
import {
  loadFollowsList,
  loadRelayList,
  loadWikiAuthors,
  loadWikiRelays,
  type Result
} from '@nostr/gadgets/lists';
import { loadNostrUser, type NostrUser } from '@nostr/gadgets/metadata';

const startTime = Math.round(Date.now() / 1000);

export const reactionKind = 7;
export const wikiKind = 30818;
export const gitPatchKind = 1617;

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
  },
  encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as any).nostr.nip04.encrypt(pubkey, plaintext);
  },
  decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as any).nostr.nip04.decrypt(pubkey, ciphertext);
  }
};

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
      recurse(loadFollowsList, 10, pubkey, 30),
      recurse(loadWikiAuthors, 6, pubkey, 30)
    ]);
    idbkv.set(`wikistr:wot`, { when: startTime, scoremap });
    set(scoremap);

    async function recurse(
      fetch: (srcpk: string) => Promise<Result<string>>,
      degrade: number,
      src: string,
      score: number
    ) {
      scoremap[src] = (scoremap[src] || 0) + score;

      if (score <= degrade) return;

      const nextkeys = await fetch(src);
      await Promise.all(
        nextkeys.items.map(async (next) => {
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
      setWOT(account.pubkey);
      unsub();
    }, 300);
  }
});

// ensure these subscriptions are always on
account.subscribe(() => {});
wot.subscribe(() => {});

export const userWikiRelays = derived(
  account,
  (account, set) => {
    if (account) {
      getBasicUserWikiRelays(account.pubkey).then(set);
    } else {
      let customRelays: string[] = [];
      if (typeof window !== 'undefined') {
        const customStored = localStorage.getItem('wikistr:custom-relays');
        if (customStored) {
          try {
            customRelays = JSON.parse(customStored);
          } catch (e) {}
        }
      }
      set(unique(customRelays, DEFAULT_WIKI_RELAYS));
    }
  },
  DEFAULT_WIKI_RELAYS
);

export async function getBasicUserWikiRelays(pubkey: string): Promise<string[]> {
  let customRelays: string[] = [];
  if (typeof window !== 'undefined') {
    const customStored = localStorage.getItem('wikistr:custom-relays');
    if (customStored) {
      try {
        customRelays = JSON.parse(customStored);
      } catch (e) {}
    }
  }

  const [rl1, rl2, rl3] = await Promise.all([
    loadWikiRelays(pubkey).then((rl) => rl.items).catch(() => []),
    Promise.all((await loadWikiAuthors(pubkey).catch(() => ({ items: [] }))).items.map((pk) => loadRelayList(pk).catch(() => null))).then((rll) =>
      rll
        .filter((rl): rl is Exclude<typeof rl, null> => rl !== null)
        .map((rl) => rl.items)
        .flat()
        .filter((ri) => ri.write)
        .map((ri) => ri.url)
    ).catch(() => []),
    loadRelayList(pubkey).then((rl) =>
      rl.items.filter((ri) => ri.write).map((ri) => ri.url)
    ).catch(() => [])
  ]);

  let list = unique(customRelays, rl1, rl2, rl3);
  if (list.length < 2) {
    list = unique(list, DEFAULT_WIKI_RELAYS);
  }

  return list;
}
