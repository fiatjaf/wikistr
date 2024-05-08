import type { NostrEvent } from 'nostr-tools';

export type EditorData = {
  title: string;
  summary: string;
  content: string;
  previous: ArticleTab | undefined;
};

export type TabType = 'welcome' | 'find' | 'article' | 'relay' | 'user' | 'settings' | 'editor' | 'new';

export interface Tab {
  id: number;
  type: TabType;
  parent?: Tab;
  back?: Tab;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export type WelcomeTab = {
  id: number;
  type: 'welcome';
  parent?: Tab;
  back?: Tab;
};

export type SearchTab = {
  id: number;
  type: 'find';
  parent?: Tab;
  back?: Tab;
  data: string; // article title query
  preferredAuthors: string[];
};

export type ArticleTab = {
  id: number;
  type: 'article';
  parent?: Tab;
  back?: Tab;
  data: [string, string]; // d-tag * pubkey
  relayHints: string[];
  actualEvent?: NostrEvent; // for when we already have it we can skip relays
};

export type RelayTab = {
  id: number;
  type: 'relay';
  parent?: Tab;
  back?: Tab;
  data: string; // relay url
};

export type UserTab = {
  id: number;
  type: 'user';
  parent?: Tab;
  back?: Tab;
  data: string; // user pubkey
};

export type SettingsTab = {
  id: number;
  type: 'settings';
  parent?: Tab;
  back?: Tab;
};

export type EditorTab = {
  id: number;
  type: 'editor';
  parent?: Tab;
  back?: Tab;
  data: EditorData;
};
