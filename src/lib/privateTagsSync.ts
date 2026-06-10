import type { Event, EventTemplate } from '@nostr/tools/pure';
import { pool } from '@nostr/gadgets/global';
import { signer, wikiKind, getBasicUserWikiRelays } from './nostr';

export async function fetchPrivateTagsFromRelays(pubkey: string): Promise<void> {
  try {
    const relays = await getBasicUserWikiRelays(pubkey);
    let latestEvent: Event | null = null;

    await new Promise<void>((resolve) => {
      const sub = pool.subscribeMany(
        relays,
        [
          {
            kinds: [30003],
            authors: [pubkey],
            '#d': ['wikistr-private-tags']
          }
        ],
        {
          id: 'fetch-private-tags',
          onevent(evt) {
            if (!latestEvent || evt.created_at > latestEvent.created_at) {
              latestEvent = evt;
            }
          },
          oneose() {
            sub.close();
            resolve();
          }
        }
      );
      // Timeout fallback in case relays are unresponsive
      setTimeout(() => {
        sub.close();
        resolve();
      }, 3500);
    });

    if (latestEvent) {
      const ciphertext = (latestEvent as Event).content;
      if (!ciphertext) return;

      const plaintext = await signer.decrypt(pubkey, ciphertext);
      const parsed = JSON.parse(plaintext);
      
      if (Array.isArray(parsed)) {
        const privateTagsMap: { [key: string]: string[] } = {};
        
        parsed.forEach((tagArray) => {
          if (Array.isArray(tagArray) && tagArray[0] === 'a') {
            const coord = tagArray[1]; // e.g. "30818:pubkey:dtag"
            const label = tagArray[3]; // tag name
            
            if (coord && label && coord.startsWith(`${wikiKind}:`)) {
              // Strip "30818:" prefix to get "pubkey:dtag"
              const key = coord.substring(`${wikiKind}:`.length);
              if (!privateTagsMap[key]) {
                privateTagsMap[key] = [];
              }
              if (!privateTagsMap[key].includes(label)) {
                privateTagsMap[key].push(label);
              }
            }
          }
        });
        
        localStorage.setItem('wikistr:private-tags', JSON.stringify(privateTagsMap));
        window.dispatchEvent(new Event('wikistr:dashboard-update'));
      }
    }
  } catch (e) {
    console.error('Failed to sync private tags from relays', e);
  }
}

export async function publishPrivateTagsToRelays(pubkey: string): Promise<void> {
  try {
    const stored = localStorage.getItem('wikistr:private-tags');
    const allPrivateTags = stored ? JSON.parse(stored) : {};
    
    const bookmarksArray: string[][] = [];
    Object.entries(allPrivateTags).forEach(([key, list]) => {
      if (Array.isArray(list)) {
        list.forEach((tag) => {
          bookmarksArray.push(['a', `${wikiKind}:${key}`, '', tag]);
        });
      }
    });

    const encryptedContent = await signer.encrypt(pubkey, JSON.stringify(bookmarksArray));
    const relays = await getBasicUserWikiRelays(pubkey);

    const eventTemplate: EventTemplate = {
      kind: 30003,
      tags: [['d', 'wikistr-private-tags']],
      content: encryptedContent,
      created_at: Math.round(Date.now() / 1000)
    };

    const signedEvent = await signer.signEvent(eventTemplate);
    
    // Publish to all write relays
    await Promise.all(
      relays.map(async (url) => {
        try {
          const r = await pool.ensureRelay(url);
          await r.publish(signedEvent);
        } catch (err) {
          console.error(`Failed to publish private tags to relay ${url}`, err);
        }
      })
    );
  } catch (e) {
    console.error('Failed to publish private tags to relays', e);
  }
}
