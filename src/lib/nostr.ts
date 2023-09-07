import {
  NostrSystem,
  EventPublisher,
  Nip7Signer,
  UserRelaysCache,
  UserProfileCache,
} from '@snort/system';

export const reactionKind = 7;
export const labelKind = 1985;
export const wikiKind = 30818;

const localStorageRelaysKey = 'static-relays';

export function getStaticRelays(): string[] {
  const val = localStorage.getItem(localStorageRelaysKey);
  if (val) return JSON.parse(val);

  return [
    'wss://nostr.mom',
    'wss://relay.damus.io',
    'wss://nostr-pub.wellorder.net',
    'wss://relay.nostr.band',
    'wss://relay.primal.net'
  ];
}

export function saveStaticRelays(relays: string[]) {
  localStorage.setItem(localStorageRelaysKey, JSON.stringify(relays));
}

export const publisher = async () => await EventPublisher.nip7();
export const signer = new Nip7Signer();
export const relayCache = new UserRelaysCache();
export const profileCache = new UserProfileCache();

export const system = new NostrSystem({
  relayCache,
  profileCache,
  authHandler: async (challenge: string, relay: string) => {
    const pub = await publisher();
    if (pub) {
      return await pub.nip42Auth(challenge, relay);
    }
  }
});

system.Init();

getStaticRelays().forEach((relay) => {
  system.ConnectToRelay(relay, { read: true, write: true });
});
