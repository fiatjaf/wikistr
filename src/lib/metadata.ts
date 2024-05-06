import DataLoader from 'dataloader';
import type { Filter } from 'nostr-tools/filter';
import { npubEncode } from 'nostr-tools/nip19';

import { dataloaderCache } from '$lib/utils';
import { _pool } from './nostr';
import { DEFAULT_METADATA_QUERY_RELAYS } from './defaults';

export type ProfileMetadata = {
  name?: string;
  picture?: string;
  about?: string;
  display_name?: string;
  website?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
};

export type NostrUser = {
  pubkey: string;
  npub: string;
  shortName: string;
  image?: string;
  metadata: ProfileMetadata;
  lastUpdated: number;
};

export function bareNostrUser(pubkey: string): NostrUser {
  const npub = npubEncode(pubkey);
  return {
    pubkey,
    npub,
    shortName: npub.substring(0, 8) + '…' + npub.substring(59),
    metadata: {},
    lastUpdated: 0
  };
}

export async function loadNostrUser(pubkey: string): Promise<NostrUser> {
  return await metadataLoader.load(pubkey);
}

const metadataLoader = new DataLoader<string, NostrUser, string>(
  async (keys) =>
    new Promise(async (resolve) => {
      const results = new Array<NostrUser | Error>(keys.length);
      const filter: Filter = { kinds: [0], authors: keys.slice(0) };

      // fill in the defaults
      for (let i = 0; i < keys.length; i++) {
        const pubkey = keys[i];
        const npub = npubEncode(pubkey);
        results[i] = {
          pubkey: pubkey,
          npub,
          shortName: npub.substring(0, 8) + '…' + npub.substring(59),
          lastUpdated: 0,
          metadata: {}
        };
      }

      try {
        _pool.subscribeManyEose(DEFAULT_METADATA_QUERY_RELAYS, [filter], {
          onevent(evt) {
            for (let i = 0; i < keys.length; i++) {
              if (keys[i] === evt.pubkey) {
                const nu = results[i] as NostrUser;
                if (nu.lastUpdated > evt.created_at) return;

                let md: any = {};
                try {
                  md = JSON.parse(evt!.content);
                } catch {
                  /**/
                }

                nu.metadata = md;
                nu.shortName =
                  md.name || md.display_name || md.nip05?.split('@')?.[0] || nu.shortName;

                if (md.picture) nu.image = md.picture;

                return;
              }
            }
          },
          onclose() {
            resolve(results);
          }
        });
      } catch (err) {
        for (let i = 0; i < results.length; i++) {
          results[i] = err as Error;
        }
        resolve(results);
      }
    }),
  {
    cache: true,
    cacheMap: dataloaderCache<NostrUser>()
  }
);
