import type { NostrEvent } from '@nostr/tools/pure';

export type EditorData = {
  title: string;
  summary: string;
  content: string;
  tags?: string[];
  previous: Card | undefined;
};

export type Card =
  | WelcomeCard
  | RecentCard
  | NewCard
  | SearchCard
  | ArticleCard
  | RelayCard
  | SettingsCard
  | UserCard
  | EditorCard;

export function serializeCardForRouter(card: Card) {
  const serialized = { ...card };

  if (serialized.back) {
    serialized.back = serializeCardForRouter(serialized.back);
  }

  switch (serialized.type) {
    case 'find':
      if (serialized.results) serialized.results = [...serialized.results].map(eventOutFromProxy);
      break;
    case 'article':
      if (serialized.actualEvent)
        serialized.actualEvent = eventOutFromProxy(serialized.actualEvent);
      if (serialized.versions)
        serialized.versions = [...serialized.versions].map(eventOutFromProxy);
      break;
    case 'editor':
      if (serialized.data && serialized.data.previous) {
        serialized.data = {
          ...serialized.data,
          previous: serializeCardForRouter(serialized.data.previous)
        };
      }
      break;
  }

  return serialized;
}

function eventOutFromProxy(event: NostrEvent): NostrEvent {
  return { ...event, tags: [...event.tags].map((tag) => [...tag]) };
}

export type WelcomeCard = {
  id: number;
  type: 'welcome';
  back?: Card;
};

export type RecentCard = {
  id: number;
  type: 'recent';
  back?: Card;
};

export type NewCard = {
  id: number;
  type: 'new';
  back: undefined;
};

export type SearchCard = {
  id: number;
  type: 'find';
  back?: Card;
  data: string; // article title query
  preferredAuthors: string[];
  results?: NostrEvent[];
  seenCache?: { [id: string]: string[] };
  redirect?: boolean;
};

export type ArticleCard = {
  id: number;
  type: 'article';
  back?: Card;
  data: [string, string]; // d-tag * pubkey
  relayHints: string[];
  actualEvent?: NostrEvent; // for when we already have it we can skip relays
  versions?: NostrEvent[];
};

export type RelayCard = {
  id: number;
  type: 'relay';
  back?: Card;
  data: string; // relay url
};

export type UserCard = {
  id: number;
  type: 'user';
  back?: Card;
  data: string; // user pubkey
};

export type SettingsCard = {
  id: number;
  type: 'settings';
  back?: Card;
};

export type EditorCard = {
  id: number;
  type: 'editor';
  back?: Card;
  data: EditorData;
};
