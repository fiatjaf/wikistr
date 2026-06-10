import type { Filter } from '@nostr/tools/filter';
import type { SubCloser, SubscribeManyParams } from '@nostr/tools/pool';
import { pool } from '@nostr/gadgets/global';
import { loadRelayList } from '@nostr/gadgets/lists';
import { outboxFilterRelayBatch } from '@nostr/gadgets/outbox';

export function subscribeAllOutbox(
  pubkeys: string[],
  baseFilter: Omit<Filter, 'authors'> & { limit: number },
  params: any
): SubCloser {
  let closed = false;
  let subc: SubCloser;

  outboxFilterRelayBatch(pubkeys, baseFilter).then((requests) => {
    subc = pool.subscribeMap(requests, { id: 'alloutbox', ...params });
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

export function subscribeOutbox(
  pubkey: string,
  baseFilter: Omit<Filter, 'authors'> & { limit: number },
  params: any
): SubCloser {
  let closed = false;
  let subc: SubCloser;

  const filter = baseFilter as Filter;
  filter.authors = [pubkey];

  loadRelayList(pubkey).then((relayItems) => {
    if (closed) return;

    const relays = relayItems.items.filter((ri) => ri.write).map((ri) => ri.url);
    const actualRelays = relays.slice(0, Math.min(relays.length, 4));

    subc = pool.subscribeMany(actualRelays, [filter], { id: 'singleoutbox', ...params });
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
