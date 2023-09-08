import {
  EventKind,
  FlatNoteStore,
  RequestBuilder,
  NoteCollection,
  type NostrEvent,
  type StoreSnapshot
} from '@snort/system';
import { findTag } from '@snort/system/dist/utils';
import { readable } from 'svelte/store';
import debounce from 'debounce';

import { system, labelKind, wikiKind, signer } from '$lib/nostr';

const requestId = 'labels';

let resolveSetterArticles: (_: (fn: Articles) => void) => void;
let resolveSetterPeople: (_: (fn: People) => void) => void;
const setterArticles: Promise<(fn: Articles) => void> = new Promise((resolve) => {
  resolveSetterArticles = resolve;
});
const setterPeople: Promise<(fn: People) => void> = new Promise((resolve) => {
  resolveSetterPeople = resolve;
});

export const articles = readable({} as Articles, (set) => {
  resolveSetterArticles(set);
});
export const people = readable({} as People, (set) => {
  resolveSetterPeople(set);
});

type Article = {
  score: number;
};
type Articles = Record<string, Article>;

type Person = {
  score: number;
};
type People = Record<string, Person>;

const opts = { leaveOpen: true };

signer
  .getPubKey()
  .then((pubkey) => {
    const rb = new RequestBuilder(requestId);
    rb.withOptions(opts);
    rb.withFilter().kinds([EventKind.ContactList]).authors([pubkey]);
    rb.withFilter()
      .kinds([labelKind as EventKind])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .tag('l' as any, ['wiki'])
      .authors([pubkey]);

    const q = system.Query(FlatNoteStore, rb);

    const compute = debounce(async () => {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<NoteCollection['getSnapshotData']>>;
      if (!state.data) return;

      // prepare a new query
      const rb = new RequestBuilder(requestId);
      rb.withOptions(opts);

      const setArticles = await setterArticles;
      const setPeople = await setterPeople;

      const articles: Articles = {};
      const people: People = {
        [pubkey]: { score: 100 }
      };

      // we'll go 3 levels deep of relationships and labeling
      const levels: NostrEvent[][] = [[], [], []];
      const keys: string[][] = [[pubkey], [], []];
      let rest = state.data;

      for (let level = 0; level < 3; level++) {
        const newrest = [];
        for (let i = 0; i < rest.length; i++) {
          const event = rest[i];
          if (keys[level].includes(event.pubkey)) {
            levels[level].push(event);
            keys[level + 1]?.push?.(event.pubkey);
          } else newrest.push(event);
        }
        rest = newrest;

        for (let i = 0; i < levels[level].length; i++) {
          const event = levels[level][i];
          switch (event.kind) {
            case EventKind.ContactList: {
              // load contact lists and labels of people in this level
              if (level === levels.length - 1) continue; // except in the last

              for (let c = 0; c < event.tags.length; c++) {
                const follow = event.tags[c][1];
                if (!follow || event.tags[c][0] !== 'p') continue;
                rb.withFilter().kinds([EventKind.ContactList]).authors([follow]);
                rb.withFilter()
                  .kinds([labelKind as EventKind])
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .tag('l' as any, ['wiki'])
                  .authors([follow]);

                keys[level + 1]?.push?.(follow);
              }
              break;
            }
            case EventKind.Reaction: {
              const a = findTag(event, 'a');
              if (!a) continue;

              let article = articles[a];
              if (!article) {
                article = { score: 0 };
                articles[a] = article;
              }
              article.score += 25 - 7 * level;

              const [_k, p] = a.split(':');
              let person = people[p];
              if (!person) {
                person = { score: 0 };
                people[p] = person;
              }
              person.score += 15 - 4 * level;
              keys[level + 1]?.push?.(p);

              break;
            }
            case labelKind: {
              const l = event.tags.find(
                ([k, v, _L, d]) => k === 'l' && v === 'wiki' && typeof d === 'string' && d !== ''
              );
              if (!l) continue;

              let data = { quality: 25, confidence: 50 };
              try {
                data = JSON.parse(l[3]) as { quality: number; confidence: number };
              } catch (err) {
                /***/
              }
              const labelScore = (data.quality - 50) * (data.confidence / 100);

              const a = findTag(event, 'a');
              if (a) {
                let article = articles[a];
                if (!article) {
                  article = { score: 0 };
                  articles[a] = article;
                }
                article.score += labelScore - 7 * level;

                const [_k, p] = a.split(':');
                let person = people[p];
                if (!person) {
                  person = { score: 0 };
                  people[p] = person;
                }
                person.score += (labelScore * 2) / 3 - 4 * level;
                keys[level].push(p);

                continue;
              }

              const p = findTag(event, 'p');
              if (p) {
                let person = people[p];
                if (!person) {
                  person = { score: 0 };
                  people[p] = person;
                }
                person.score += labelScore - 7 * level;
                keys[level].push(p);
              }

              break;
            }
          }
        }
      }

      // fire new queries we queued during this phase
      system.Query(NoteCollection, rb);

      setPeople(people);
      setArticles(articles);
    }, 1500);

    q.feed.hook(compute);
  })
  .catch((err) => {
    console.warn('could not get pubkey:', err);
  });

export function track(event: NostrEvent) {
  const a = `${wikiKind}:${event.pubkey}:${event.tags.find(([k]) => k === 'd')?.[1] || ''}`;

  const rb = new RequestBuilder(requestId);
  rb.withOptions(opts);

  rb.withFilter()
    .kinds([labelKind as EventKind])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .tag('l' as any, ['wiki'])
    .tag('a', [a]);

  rb.withFilter().kinds([EventKind.Reaction]).tag('a', [a]);

  system.Query(FlatNoteStore, rb);
}
