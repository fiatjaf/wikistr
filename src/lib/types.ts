export type TabType = 'welcome' | 'articlefind' | 'article' | 'settings' | 'editor';

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
  data: string; // event id
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
