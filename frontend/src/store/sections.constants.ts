// frontend/src/store/sections.constants.ts

export type SectionKey =
  | 'services'
  | 'sell'
  | 'rent'
  | 'jobs'
  | 'education'
  | 'misc';

export type SectionItem = {
  key: SectionKey;
  title: string;
};

export const SECTIONS: SectionItem[] = [
  { key: 'services', title: 'Услуги' },
  { key: 'sell', title: 'Продажа' },
  { key: 'rent', title: 'Аренда' },
  { key: 'jobs', title: 'Работа' },
  { key: 'education', title: 'Обучение' },
  { key: 'misc', title: 'Разное' },
];

export const INITIAL_SECTIONS_STATE = {
  selectedKeys: [] as SectionKey[],
};
