export type TabType = 'welcome' | 'find' | 'article' | 'relay' | 'settings' | 'editor' | 'new';

export interface Tab {
  id: number;
  type: TabType;
  parent?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export type WelcomeTab = {
  id: number;
  type: TabType;
  parent?: number;
};

export type SearchTab = {
  id: number;
  type: TabType;
  parent?: number;
  data: string; // article title query
};

export type ArticleTab = {
  id: number;
  type: TabType;
  parent?: number;
  data: [string, string]; // d-tag * pubkey
};

export type RelayTab = {
  id: number;
  type: TabType;
  parent?: number;
  data: string; // relay url
};

export type SettingsTab = {
  id: number;
  type: TabType;
  parent?: number;
};

export type EditorTab = {
  id: number;
  type: TabType;
  parent?: number;
  data: EditorData;
};

export type EditorData = {
  title: string;
  summary: string;
  content: string;
  previous: ArticleTab | undefined;
};
