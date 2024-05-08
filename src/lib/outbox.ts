import type { Filter, SubCloser, SubscribeManyParams } from 'nostr-tools';
import { loadRelayList } from './lists';
import { _pool } from './nostr';
import { normalizeURL } from 'nostr-tools/utils';

export function subscribeAllOutbox(
  pubkeys: string[],
  baseFilter: Omit<Filter, 'authors'> & { limit: number },
  params: SubscribeManyParams
): SubCloser {
  let closed = false;
  let subc: SubCloser;

  Promise.all(pubkeys.map((pubkey) => loadRelayList(pubkey))).then((relayLists) => {
    if (closed) return;

    const requests: { [relay: string]: Filter[] } = {};
    for (let p = 0; p < pubkeys.length; p++) {
      const pubkey = pubkeys[p];
      const relays = relayLists[p];
      const thre = Math.min(relays.length, 2);
      for (let r = 0; r < thre; r++) {
        try {
          const relay = relays[r];
          if (relay.write) {
            const url = normalizeURL(relay.url);

            if (!(url in requests)) {
              requests[url] = [{ authors: [], ...baseFilter }];
            }
            requests[url][0].authors?.push(pubkey);
            requests[url][0].limit = Math.round(requests[url][0].limit! * 1.4);
          }
        } catch (err) {
          /***/
        }
      }
    }
    subc = _pool.subscribeManyMap(requests, { id: 'alloutbox', ...params });
    if (closed) {
      subc.close();
    }
  });

  return {
    close() {
      if (subc) {
        subc.close();
      }
      closed = true;
    }
  };
}
