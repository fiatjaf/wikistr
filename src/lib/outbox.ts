import type { Filter, NostrEvent, SubCloser } from 'nostr-tools';
import { loadRelayList } from './lists';
import { _pool, wikiKind } from './nostr';
import { normalizeURL } from 'nostr-tools/utils';

export function subscribeAllOutbox(
  pubkeys: string[],
  onevent: (evt: NostrEvent) => void
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
              requests[url] = [{ authors: [], kinds: [wikiKind], limit: 20 }];
            }
            requests[url][0].authors?.push(pubkey);
            requests[url][0].limit = Math.round((requests[url][0].limit || 20) * 1.4);
          }
        } catch (err) {
          /***/
        }
      }
    }
    subc = _pool.subscribeManyMap(requests, { id: 'alloutbox', onevent });
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
