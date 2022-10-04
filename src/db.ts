import Dexie from 'dexie';

export interface GameMap {
  id?: number;
  name: string;
}

export interface MapTile {
  id?: number;
  map: number;
  x: number;
  y: number;
  name?: string;
  img?: string;
  notes?: string;
  unsolved?: number;
}

export interface TilePicture {
  id?: number;
  tileId: number;
  img: string;
}

export interface TileLink {
  id?: number;
  map: number;
  from: number;
  to: number;
  fromOffsetX: number;
  fromOffsetY: number;
  toOffsetX: number;
  toOffsetY: number;
}

export class MulanaDB extends Dexie {
  maps!: Dexie.Table<GameMap, number>;
  tiles!: Dexie.Table<MapTile, number>;
  tilepics!: Dexie.Table<TilePicture, number>;
  tilelinks!: Dexie.Table<TileLink, number>;

  constructor() {
    super('mulanadb');

    this.version(5).stores({
      maps: '++id,name',
      tiles: '++id,map,x,y,img,notes,name,unsolved',
      tilepics: '++id,tileId,img',
      tilelinks: '++id,map,from,to,fromOffsetX,fromOffsetY,toOffsetX,toOffsetY',
    });
  }
}

export const db = new MulanaDB();
