import DataLoader from 'dataloader';
import type { NostrEvent } from 'nostr-tools/core';
import type { Filter } from 'nostr-tools/filter';
import type { SubCloser } from 'nostr-tools/abstract-pool';

import { _pool } from './nostr';

import {
  DEFAULT_FALLBACK_RELAYS,
  DEFAULT_METADATA_QUERY_RELAYS,
  DEFAULT_RELAYLIST_RELAYS
} from './defaults';
import { normalizeURL } from 'nostr-tools/utils';
import { dataloaderCache } from './utils';

let serial = 0;

function randomPick<L>(list: L[]): L {
  serial++;
  return list[serial % list.length];
}

export type RelayItem = {
  url: string;
  read: boolean;
  write: boolean;
};

export const loadRelayList = makeListFetcher<RelayItem>(
  10002,
  DEFAULT_RELAYLIST_RELAYS,
  itemsFromTags<RelayItem>(nip65RelayFromTag)
);
export const loadContactList = makeListFetcher<string>(
  3,
  DEFAULT_METADATA_QUERY_RELAYS,
  itemsFromTags<string>(pFromTag)
);
export const loadWikiRelaysList = makeListFetcher<string>(
  10102,
  DEFAULT_FALLBACK_RELAYS,
  itemsFromTags<string>(relayFromTag)
);
export const loadWikiAuthors = makeListFetcher<string>(
  10101,
  DEFAULT_FALLBACK_RELAYS,
  itemsFromTags<string>(pFromTag)
);

function itemsFromTags<I>(
  tagProcessor: (tag: string[]) => Promise<I | undefined> | I | undefined
): (event: NostrEvent | undefined) => Promise<I[]> {
  return async (event: NostrEvent | undefined) => {
    const items = event ? (await Promise.all(event.tags.map(tagProcessor))).filter(identity) : [];
    return items as I[];
  };
}

function makeListFetcher<I>(
  kind: number,
  hardcodedRelays: string[],
  process: (event: NostrEvent | undefined) => Promise<I[]> | I[]
) {
  const cache = dataloaderCache<I[]>();

  const dataloader = new DataLoader<{ target: string; relays: string[] }, I[], string>(
    (requests) =>
      new Promise(async (resolve) => {
        const results = new Array<NostrEvent | undefined>(requests.length);
        const filtersByRelay: { [url: string]: Filter[] } = {};
        for (let i = 0; i < requests.length; i++) {
          const req = requests[i];
          const relays = req.relays.slice(0, Math.min(4, req.relays.length));
          do {
            relays.push(randomPick(hardcodedRelays));
          } while (relays.length < 3);
          for (let j = 0; j < relays.length; j++) {
            const url = relays[j];
            let filters = filtersByRelay[url];
            if (!filters) {
              filters = [{ kinds: [kind], authors: [] }];
              filtersByRelay[url] = filters;
            }
            filters[0]?.authors?.push(req.target);
          }
        }

        try {
          let handle: SubCloser | undefined;
          // eslint-disable-next-line prefer-const
          handle = _pool.subscribeManyMap(filtersByRelay, {
            id: `kind:${kind}:batch(${requests.length})`,
            onevent(evt) {
              for (let i = 0; i < requests.length; i++) {
                if (requests[i].target === evt.pubkey) {
                  const res = results[i];
                  if ((res as NostrEvent)?.created_at || 0 > evt.created_at) return;
                  results[i] = evt;
                  return;
                }
              }
            },
            oneose() {
              handle?.close();
            },
            async onclose() {
              const processed: (I[] | Promise<I[]>)[] = Array(results.length);
              for (let i = 0; i < results.length; i++) {
                processed[i] = process(results[i]);
              }

              resolve(await Promise.all(processed));
            }
          });
        } catch (err) {
          resolve(results.map((_) => err as Error));
        }
      }),
    {
      cache: true,
      cacheKeyFn: (req) => req.target,
      cacheMap: cache
    }
  );

  return async function (pubkey: string): Promise<I[]> {
    let relays: string[] = [];
    if (kind !== 10002) {
      const rl = await loadRelayList(pubkey);
      relays = rl
        .filter(({ write }) => write)
        .map(({ url }) => url)
        .slice(0, 3);
    }

    return await dataloader.load({ target: pubkey, relays });
  };
}

function relayFromTag(tag: string[]): string | undefined {
  if (tag.length === 2 && tag[0] === 'relay') {
    return normalizeURL(tag[1]);
  }
}

function pFromTag(tag: string[]): string | undefined {
  if (tag.length >= 2 && tag[0] === 'p') {
    return tag[1];
  }
}

function nip65RelayFromTag(tag: string[]): RelayItem | undefined {
  if (tag.length === 2) {
    return { url: tag[1], read: true, write: true };
  } else if (tag[2] === 'read') {
    return { url: tag[1], read: true, write: false };
  } else if (tag[2] === 'write') {
    return { url: tag[1], read: false, write: true };
  }
}

function identity<A>(a: A): boolean {
  return Boolean(a);
}
