export type TabType = 'welcome' | 'find' | 'article' | 'relay' | 'settings' | 'editor' | 'new';

export interface Tab {
  id: number;
  type: TabType;
  parent?: Tab;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export type WelcomeTab = {
  id: number;
  type: 'welcome';
  parent?: Tab;
};

export type SearchTab = {
  id: number;
  type: 'find';
  parent?: Tab;
  data: string; // article title query
  preferredAuthors: string[];
};

export type ArticleTab = {
  id: number;
  type: 'article';
  parent?: Tab;
  data: [string, string]; // d-tag * pubkey
  relayHints: string[];
};

export type RelayTab = {
  id: number;
  type: 'relay';
  parent?: Tab;
  data: string; // relay url
};

export type SettingsTab = {
  id: number;
  type: 'settings';
  parent?: Tab;
};

export type EditorTab = {
  id: number;
  type: 'editor';
  parent?: Tab;
  data: EditorData;
};

export type EditorData = {
  title: string;
  summary: string;
  content: string;
  previous: ArticleTab | undefined;
};
