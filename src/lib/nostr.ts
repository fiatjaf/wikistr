import NDK, { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

export const wikiKind = 30818;

const localStorageRelaysKey = 'static-relays';

export function getStaticRelays() {
  const val = localStorage.getItem(localStorageRelaysKey);
  if (val) return JSON.parse(val);

  return [
    'wss://nostr.mom',
    'wss://relay.damus.io',
    'wss://nostr-pub.wellorder.net',
    'wss://relay.nostr.band'
  ];
}

export function saveStaticRelays(relays: string[]) {
  localStorage.setItem(localStorageRelaysKey, JSON.stringify(relays));
}

export const ndk: NDK = new NDK({
  explicitRelayUrls: getStaticRelays(),
  cacheAdapter: new NDKCacheAdapterDexie({ dbName: 'w-cache' }),
  signer: new NDKNip07Signer()
});
