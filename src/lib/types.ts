import type { NostrEvent } from 'nostr-tools';

export type EditorData = {
  title: string;
  summary: string;
  content: string;
  previous: ArticleCard | undefined;
};

export type CardType = 'welcome' | 'find' | 'article' | 'relay' | 'user' | 'settings' | 'editor' | 'new';

export interface Card {
  id: number;
  type: CardType;
  parent?: Card;
  back?: Card;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export type WelcomeCard = {
  id: number;
  type: 'welcome';
  parent?: Card;
  back?: Card;
};

export type SearchCard = {
  id: number;
  type: 'find';
  parent?: Card;
  back?: Card;
  data: string; // article title query
  preferredAuthors: string[];
};

export type ArticleCard = {
  id: number;
  type: 'article';
  parent?: Card;
  back?: Card;
  data: [string, string]; // d-tag * pubkey
  relayHints: string[];
  actualEvent?: NostrEvent; // for when we already have it we can skip relays
};

export type RelayCard = {
  id: number;
  type: 'relay';
  parent?: Card;
  back?: Card;
  data: string; // relay url
};

export type UserCard = {
  id: number;
  type: 'user';
  parent?: Card;
  back?: Card;
  data: string; // user pubkey
};

export type SettingsCard = {
  id: number;
  type: 'settings';
  parent?: Card;
  back?: Card;
};

export type EditorCard = {
  id: number;
  type: 'editor';
  parent?: Card;
  back?: Card;
  data: EditorData;
};
