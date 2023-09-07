import { system, reactionKind, labelKind, wikiKind, signer } from '$lib/nostr';
import {
  EventKind,
  FlatNoteStore,
  RequestBuilder,
  type NostrEvent,
  type StoreSnapshot
} from '@snort/system';

signer
  .getPubKey()
  .then((pubkey) => {
    const rb = new RequestBuilder('labels');
    rb.withOptions({ leaveOpen: true });
    rb.withFilter()
      .kinds([labelKind as EventKind])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .tag('l' as any, ['wiki'])
      .authors([pubkey]);

    const q = system.Query(FlatNoteStore, rb);
    q.feed.hook(() => {
      const state = q.feed.snapshot as StoreSnapshot<ReturnType<FlatNoteStore['getSnapshotData']>>;
      console.log(state);
    });
  })
  .catch((err) => {
    console.warn('could not get pubkey:', err);
  });

export function track(event: NostrEvent) {
  const a = `${wikiKind}:${event.pubkey}:${event.tags.find(([k]) => k === 'd')?.[1] || ''}`;

  const rb = new RequestBuilder('labels');
  rb.withOptions({ leaveOpen: true });

  rb.withFilter()
    .kinds([labelKind as EventKind])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .tag('l' as any, ['wiki'])
    .tag('a', [a]);

  rb.withFilter()
    .kinds([reactionKind as EventKind])
    .tag('a', [a]);

  system.Query(FlatNoteStore, rb);
}
