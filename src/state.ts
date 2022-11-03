import { atom } from 'recoil';

const localStorageEffect =
  (key: string) =>
  ({ setSelf, onSet }: any) => {
    const savedValue = localStorage.getItem(key);
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue));
    }

    onSet((newValue: any, _: any, isReset: any) => {
      isReset ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(newValue));
    });
  };

export const activemapState = atom({
  key: 'activemap',
  default: -1,
  effects: [localStorageEffect('activemap')],
});

export const mulanamodeState = atom({
  key: 'mulanamode',
  default: 1,
  effects: [localStorageEffect('mulanamode')],
});
