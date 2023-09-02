import { NostrSystem, EventPublisher, Nip7Signer, UserRelaysCache } from '@snort/system';

export const wikiKind = 30818;
export const labelKind = 1985;

const localStorageRelaysKey = 'static-relays';

export function getStaticRelays(): string[] {
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

export const publisher = async () => await EventPublisher.nip7();
export const signer = new Nip7Signer();

export const system = new NostrSystem({
  relayCache: new UserRelaysCache(),
  authHandler: async (challenge: string, relay: string) => {
    const pub = await publisher();
    if (pub) {
      return await pub.nip42Auth(challenge, relay);
    }
  }
});

getStaticRelays().forEach((relay) => {
  system.ConnectToRelay(relay, { read: true, write: true });
});
