import { Dialog, Transition } from '@headlessui/react';
import {
  LanguageIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import axios from 'axios';
import Fuse from 'fuse.js';
import produce from 'immer';
import { debounce, maxBy, uniqWith } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropzone from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { toast, ToastContainer } from 'react-toastify';
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useRecoilState } from 'recoil';
import { Button } from './Button';
import { db, GameMap, MapTile, TilePicture } from './db';
import { activemapState, mulanamodeState } from './state';
import { alphabet, drawLinks, fuseOptions, getImageSrc } from './utils';

interface TempLink {
  tile: number;
  offsetX: number;
  offsetY: number;
}

const App = () => {
  const [maps, setmaps] = useState<GameMap[]>([]);
  const [allnotes, setallnotes] = useState<MapTile[]>([]);
  const [map, setmap] = useState<(MapTile | null)[][]>([]);
  const [maxX, setmaxX] = useState(0);
  const [maxY, setmaxY] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTile, setactiveTile] = useState<MapTile | null>(null);
  const [tilepics, settilepics] = useState<TilePicture[]>([]);
  const [activemap, setactivemap] = useRecoilState(activemapState);
  const { register, handleSubmit, reset, setFocus } = useForm();
  const [utiles, setutiles] = useState<MapTile[]>([]);
  const panRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [maploading, setmaploading] = useState(false);
  const [linkmode, setlinkmode] = useState<boolean>(false);
  const [showlinks, setshowlinks] = useState<boolean>(false);
  const [templink, settemplink] = useState<TempLink>();
  const [searchresults, setsearchresults] = useState<Fuse.FuseResult<MapTile>[]>([]);
  const [highlight, sethighlight] = useState<number | null>(null);
  const [mulanamode, setmulanamode] = useRecoilState(mulanamodeState);

  const tWidth = mulanamode === 1 ? 320 : 431;
  const tHeight = 240;

  async function refreshMap(mapId?: number | null) {
    setmaploading(true);
    const maps = await db.maps.toArray();
    setmaps(maps);
    if (maps.length > 0) {
      const dbmapTiles: MapTile[] = [];
      const dballnotes: MapTile[] = [];
      await db.tiles.each((tile) => {
        dballnotes.push({
          id: tile.id,
          map: tile.map,
          name: tile.name,
          notes: tile.notes,
        } as any);
        if (tile.map === (mapId ? mapId : activemap !== -1 ? activemap : maps[0].id!)) {
          dbmapTiles.push(tile);
        }
      });
      setallnotes(dballnotes);
      const maxX = maxBy(dbmapTiles, 'x') ? maxBy(dbmapTiles, 'x')!.x + 1 : 1;
      const maxY = maxBy(dbmapTiles, 'y') ? maxBy(dbmapTiles, 'y')!.y + 1 : 1;
      setmaxX(maxX);
      setmaxY(maxY);
      const map: (MapTile | null)[][] = [];
      for (let index = 0; index < maxY; index++) {
        map.push(new Array(maxX));
      }
      map.forEach((_xrow, yidx) => {
        for (let xidx = 0; xidx < maxX; xidx++) {
          map[yidx][xidx] = dbmapTiles.find((tile) => tile.x === xidx && tile.y === yidx) ?? null;
        }
      });
      if (map.length === 0) {
        map.push([
          {
            map: mapId ?? maps[0].id!,
            x: 0,
            y: 0,
          },
        ]);
      }
      setmap(map);
      if (activemap === -1) {
        setactivemap(maps[0].id!);
      }
      if (showlinks) {
        const links = await db.tilelinks
          .where('map')
          .equals(activemap !== -1 ? activemap : maps[0].id!)
          .toArray();
        drawLinks(links);
      }
    }

    setmaploading(false);
  }

  useEffect(() => {
    window.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    refreshMap();

    return () => {
      window.removeEventListener('contextmenu', (event) => {
        event.preventDefault();
      });
    };
  }, []);

  async function refreshLinks() {
    const links = await db.tilelinks
      .where('map')
      .equals(activemap !== -1 ? activemap : maps[0].id!)
      .toArray();
    drawLinks(links);
  }

  useEffect(() => {
    if (showlinks) {
      refreshLinks();
    } else {
      const c: HTMLCanvasElement = document.getElementById('linecanvas') as any;
      const ctx = c.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, c.width, c.height);
    }
  }, [showlinks]);

  useEffect(() => {
    if (maps.length > 0 && activemap === -1) {
      setactivemap(maps[0].id!);
    }
  }, [maps, activemap]);

  async function openTile(tile: MapTile) {
    if (activemap !== tile.map) {
      setactivemap(tile.map);
      refreshMap(tile.map);
    }
    if (!tile.img) {
      // searchresult, need to fetch img from db
      const dbTile = await db.tiles.get(tile.id!);
      if (dbTile) {
        setactiveTile({
          ...tile,
          img: dbTile.img,
        });
      } else {
        setactiveTile(tile);
      }
    } else {
      setactiveTile(tile);
    }
    reset({
      name: tile.name,
      notes: tile.notes,
      unsolved: tile.unsolved ? 1 : 0,
    });
    const newpics = await db.tilepics.where('tileId').equals(tile.id!).toArray();
    settilepics(newpics);
    setIsOpen(true);
  }

  async function onUnsolved() {
    if (utiles.length === 0) {
      const unsolvedtiles = await db.tiles.where('unsolved').equals(1).toArray();
      setutiles(unsolvedtiles);
    } else {
      setutiles([]);
    }
  }

  async function addMap() {
    const nameinput = prompt('Enter map name');
    if (nameinput) {
      const newMapId = await db.maps.add({
        name: nameinput,
      });
      await db.tiles.add({
        map: newMapId,
        x: 0,
        y: 0,
      });
      refreshMap(newMapId);
      setactivemap(newMapId);
    }
  }

  async function deleteMap() {
    if (activemap === activemap && confirm('Are you sure you want to delete the selected map?')) {
      const mapTiles = await db.tiles.where('map').equals(activemap).toArray();
      await db.tilepics
        .where('tileId')
        .anyOf(mapTiles.map((x) => activemap))
        .delete();
      await db.tiles.bulkDelete(mapTiles.map((x) => x.id!));
      await db.maps.where('id').equals(activemap).delete();
      const newMaps = await db.maps.toArray();
      if (newMaps.length > 0) {
        refreshMap(newMaps[newMaps.length - 1].id!);
        setactivemap(newMaps[newMaps.length - 1].id!);
      } else {
        setmap([]);
        setmaps([]);
        setactivemap(0);
      }
    }
  }

  async function deleteTile() {
    if (confirm('Are you sure?')) {
      await db.tiles.delete(activeTile!.id!);
      const newmap = produce(map, (draft) => {
        draft[activeTile!.y!][activeTile!.x!] = null;
      });
      const maptiles: MapTile[] = newmap.flat().filter((x) => x !== null) as any;
      // if first row is all nulls
      if (newmap[0].every((x) => x === null)) {
        await db.tiles.bulkPut(maptiles.map((tile) => ({ ...tile, y: tile.y - 1 })));
      }
      // if first column is all nulls
      if (newmap.every((x) => x[0] === null)) {
        await db.tiles.bulkPut(maptiles.map((tile) => ({ ...tile, x: tile.x - 1 })));
      }
      await refreshMap();
      return setIsOpen(false);
    }
  }

  async function deleteLinks() {
    if (confirm('Are you sure you want to delete link to and from this tile?')) {
      await db.tilelinks.where('from').equals(activeTile!.id!).or('to').equals(activeTile!.id!).delete();
      refreshLinks();
      toast.info('Links deleted');
    }
  }

  const addTileNote = useCallback(
    async (acceptedFiles: File[]) => {
      const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
      if (!imgSrc) {
        return;
      }
      if (import.meta.env.VITE_API_KEY) {
        const onlyBase64 = imgSrc.slice(23);
        toast.info('Detecting text');
        const result = await axios.post(
          'https://vision.googleapis.com/v1/images:annotate',
          {
            requests: [
              {
                image: {
                  content: onlyBase64,
                },
                features: [
                  {
                    type: 'TEXT_DETECTION',
                  },
                ],
                imageContext: {
                  languageHints: ['en'],
                },
              },
            ],
          },
          {
            params: {
              key: import.meta.env.VITE_API_KEY,
            },
          }
        );
        let noteText = '';
        if (mulanamode === 1) {
          noteText = `${
            activeTile?.notes ? activeTile.notes + '\n\n' : ''
          }${result.data.responses[0].fullTextAnnotation.text
            .replaceAll(/^[\d]*\s*/gm, '')
            .replace(/\nOK(.|\s)*$/, '')}`;
        } else {
          noteText = `${
            activeTile?.notes ? activeTile.notes + '\n\n' : ''
          }${result.data.responses[0].fullTextAnnotation.text
            .replace('Scan Mode', '')
            .replaceAll(/^[\d]*\s*/gm, '')
            .replace(/\nCANCEL(.|\s)*$/, '')}`;
        }
        await db.tiles.update(activeTile!.id!, {
          notes: noteText,
        });
        const newtile = await db.tiles.get(activeTile!.id!);
        if (newtile) {
          if (allnotes.findIndex((x) => x.id === newtile.id) === -1) {
            setallnotes([
              ...allnotes,
              {
                id: newtile.id,
                map: newtile.map,
                name: newtile.name,
                notes: newtile.notes,
              } as any,
            ]);
          } else {
            setallnotes(
              allnotes.map((x) => {
                if (x.id === newtile.id) {
                  return {
                    ...x,
                    notes: newtile.notes,
                  };
                } else {
                  return x;
                }
              })
            );
          }
          setactiveTile(newtile);
          reset(newtile);
          setmap(
            produce(map, (draft) => {
              draft[activeTile!.y!][activeTile!.x!]!.notes = newtile.notes;
            })
          );
        }
      }

      const result = await db.tilepics.add({
        tileId: activeTile!.id!,
        img: imgSrc,
      });

      settilepics([
        ...tilepics,
        {
          id: result,
          tileId: activeTile!.id!,
          img: imgSrc,
        },
      ]);
    },
    [activeTile, tilepics]
  );

  async function onMapChange(x: React.ChangeEvent<HTMLSelectElement>) {
    setactivemap(Number(x.target.value));
    setmaploading(true);
    setshowlinks(false);
    await refreshMap(Number(x.target.value));
    setmaploading(false);
    if (panRef.current) {
      panRef.current.centerView(0.7);
    }
    sethighlight(null);
    setutiles([]);
  }

  async function renameMap() {
    const newname = prompt('Insert new name for this map');
    if (newname) {
      await db.maps.update(activemap, { name: newname });
      const maps = await db.maps.toArray();
      setmaps(maps);
      toast.info('Map name updated');
    }
  }

  async function onTileLink(tile: MapTile | null, e: React.MouseEvent) {
    if (linkmode && tile) {
      if (!templink) {
        settemplink({
          tile: tile.id!,
          offsetX: e.nativeEvent.offsetX,
          offsetY: e.nativeEvent.offsetY,
        });
      }
      if (templink) {
        await db.tilelinks.add({
          from: templink.tile,
          map: activemap,
          to: tile.id!,
          fromOffsetX: templink.offsetX,
          fromOffsetY: templink.offsetY,
          toOffsetX: e.nativeEvent.offsetX,
          toOffsetY: e.nativeEvent.offsetY,
        });
        toast.info('Link added');
        refreshLinks();
        settemplink(undefined);
        setlinkmode(false);
      }
    } else if (linkmode) {
      setlinkmode(false);
      settemplink(undefined);
      toast.info('Link cancelled');
    }
  }

  const fuse = useMemo(() => new Fuse(allnotes, fuseOptions), [allnotes]);

  const debouncedSearch = debounce((value) => {
    if (value.length > 3) {
      const result = uniqWith(
        fuse.search(value),
        (a, b) => a.item.name === b.item.name && a.item.notes === b.item.notes
      );
      sethighlight(null);
      setsearchresults(result);
    } else {
      setsearchresults([]);
    }
  }, 200);

  return (
    <div className="h-screen w-screen grid place-items-center absolute overflow-hidden">
      {<canvas className="opacity-0 absolute translate-x-full z-0" width={832} height={463} id="cropcanvas" />}
      <div className="shadow bg-white fixed top-0 left-0 flex w-full flex-row justify-between items-start p-2 z-[60]">
        <div className="flex flex-row items-center">
          <h1 className="mx-2 text-lg font-bold">mtrax.exe</h1>
          <button
            className="rounded-full p-2 bg-blue-500 mr-2 w-9 h-9 flex justify-center items-center text-white"
            onClick={async () => {
              alert(
                'Select game version with the numbered button. Create a map with the plus button. Drag screenshot files from the game to the empty tiles to start mapping\n\nLeft click to pan, wheel to zoom, right click to open tile details\n\nTo add a guiding line between two tiles (e.g. loops or portals), click the link adding button on the top and click twice on the map. The line will be drawn between those two points\n\nTo remove links, open a tile and click the Delete Links button'
              );
            }}
          >
            ?
          </button>
          {activemap !== -1 && (
            <button className="rounded-full p-2 bg-red-600 text-white mr-2" onClick={() => deleteMap()}>
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
          {maps.length === 0 && (
            <>
              <span className="mr-2">Version:</span>
              <button
                className="rounded-full p-2 bg-orange-600 w-9 h-9 text-white mr-2 flex justify-center items-center"
                onClick={() => {
                  if (mulanamode === 1) {
                    setmulanamode(2);
                  } else {
                    setmulanamode(1);
                  }
                }}
              >
                {mulanamode}
              </button>
            </>
          )}
          {activemap !== -1 && (
            <button
              className="mr-2 p-2 border-2 rounded-full hover:bg-slate-100 transition"
              onClick={() => renameMap()}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          )}
          {maps.length > 0 && (
            <select value={activemap} className="mr-2" onChange={(x) => onMapChange(x)}>
              {maps &&
                maps.map((x) => {
                  return (
                    <option key={`map_${x.id}`} value={x.id}>
                      {x.name}
                    </option>
                  );
                })}
            </select>
          )}

          <button className="mr-2 p-2 border-2 rounded-full hover:bg-slate-100 transition" onClick={() => addMap()}>
            <PlusIcon className="w-5 h-5" />
          </button>

          {activemap !== -1 && (
            <button
              className={`border border-gray-500 p-2 hover:shadow rounded-sm flex flex-row items-center mr-2 ${
                utiles.length !== 0 ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => onUnsolved()}
            >
              {utiles.length === 0 ? 'Show unsolved' : 'Hide unsolved'}
            </button>
          )}
          {activemap !== -1 && (
            <button
              className={`border border-gray-500 p-2 hover:shadow rounded-sm flex flex-row items-center mr-2 ${
                showlinks ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => {
                setshowlinks(!showlinks);
              }}
            >
              Show links
            </button>
          )}
          {activemap !== -1 && (
            <button
              className={`border border-gray-500 p-2 hover:shadow rounded-sm flex flex-row items-center ${
                linkmode ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => {
                setlinkmode(!linkmode);
                if (!showlinks) {
                  setshowlinks(true);
                }
              }}
            >
              <LinkIcon className="w-6 h-6" /> <PlusIcon className="w-6 h-6" />
            </button>
          )}
          <Transition
            show={utiles.length !== 0}
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed w-full h-screen top-14 left-0 overflow-y-scroll overflow-x-hidden bg-white">
              <div className="absolute top-0 left-0 flex flex-row flex-wrap w-screen   p-2 pb-16">
                {utiles.map((x) => {
                  return (
                    <div
                      onClick={() => openTile(x)}
                      onContextMenu={() => openTile(x)}
                      className={`w-[${tWidth}px] h-[${tHeight}px] cursor-pointer mr-2 mb-2`}
                      key={`umap_${x.id}`}
                    >
                      <img src={x.img} alt="" />
                    </div>
                  );
                })}
              </div>
            </div>
          </Transition>
        </div>

        <div className="flex flex-col justify-start items-center">
          <div className="flex flex-row items-center w-80">
            <span className="mr-2">
              <MagnifyingGlassIcon className="w-5 h-5" />
            </span>
            <input
              type="search"
              className="w-full"
              placeholder="Search notes"
              onChange={(e) => {
                // prefix 'include-match' to word to improve searching
                let searchterm = '';
                e.currentTarget.value.split(' ').forEach((x) => {
                  searchterm += `'${x} `;
                });

                return debouncedSearch(searchterm);
              }}
            />
          </div>

          {searchresults.length > 0 && (
            <div className="absolute w-96 right-2 top-16 max-h-screen overflow-y-scroll">
              {searchresults.map((x) => {
                return (
                  <div
                    key={x.refIndex}
                    onClick={() => {
                      sethighlight(x.item.id!);
                      openTile(x.item);
                    }}
                    className="drop-shadow cursor-pointer w-full border border-gray-500 rounded-sm mb-2 p-2 bg-white z-40 transition hover:drop-shadow-lg overflow-hidden hover:border-gray-800"
                  >
                    {x.item.name && <h1 className={`font-bold ${x.item.notes ? 'mb-2' : ''}`}>{x.item.name}</h1>}
                    {x.item.notes && <p className="whitespace-pre-wrap">{x.item.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Transition
        show={maploading}
        as={Fragment}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-80"
        leave="ease-in duration-200"
        leaveFrom="opacity-80"
        leaveTo="opacity-0"
      >
        <div className="z-50 bg-white fixed top-0 left-0 w-screen h-screen flex justify-center items-center">
          Loading
        </div>
      </Transition>
      <TransformWrapper ref={panRef} limitToBounds={false} doubleClick={{ disabled: true }} minScale={0.3}>
        <TransformComponent>
          <div
            style={{ width: `${maxX * tWidth}px`, height: `${maxY * tHeight}px` }}
            className="min-w-[100vw] min-h-[100vh] flex flex-row justify-start items-start relative"
          >
            <canvas
              className="z-[87] pointer-events-none"
              width={maxX * tWidth}
              height={maxY * tHeight}
              id="linecanvas"
            />
            {map?.map((xrow, yidx) => {
              return xrow.map((tile, xidx) => {
                return (
                  <div
                    id={`tile_${tile?.id!}`}
                    key={`${xidx}-${yidx}`}
                    className={`absolute ${highlight === tile?.id ? 'outline outline-8 outline-pink-500 z-10' : ''} ${
                      linkmode ? 'cursor-pointer' : ''
                    }`}
                    style={{
                      height: `${tHeight}px`,
                      width: `${tWidth}px`,
                      top: `${yidx * tHeight}px`,
                      left: `${xidx * tWidth}px`,
                    }}
                    onClick={(e) => onTileLink(tile, e)}
                  >
                    {tile && tile.unsolved == 1 && (
                      <div>
                        <QuestionMarkCircleIcon className="w-4 h-4 p-0.5 bg-blue-500 absolute top-0 left-0 z-30 text-white rounded-br-lg" />
                      </div>
                    )}
                    {tile && tile.img && !tile.name && (
                      <div>
                        <LanguageIcon className="w-4 h-4 p-0.5 bg-red-500 absolute bottom-0 left-0 z-30 text-white rounded-tr-lg" />
                      </div>
                    )}
                    {(tile === null || !tile.img) && (
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          if (tile?.id) {
                            await db.tiles.update(tile.id, { img: imgSrc });
                            setmap(
                              produce(map, (draft) => {
                                draft[yidx][xidx]!.img = imgSrc;
                              })
                            );
                          } else {
                            const result = await db.tiles.add({
                              map: activemap,
                              x: xidx,
                              y: yidx,
                              img: imgSrc,
                            });
                            setmap(
                              produce(map, (draft) => {
                                draft[yidx][xidx] = {
                                  id: result,
                                  map: activemap,
                                  x: xidx,
                                  y: yidx,
                                  img: imgSrc,
                                };
                              })
                            );
                          }
                        }}
                      >
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className="group w-full h-full border grid place-items-center hover:bg-slate-50 transition after:hover:content-['Drag_image_here'] text-center"
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="group-hover:hidden text-xl">+</span>
                          </div>
                        )}
                      </Dropzone>
                    )}
                    {tile && tile.img && (
                      <img
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (highlight === tile.id) {
                            sethighlight(null);
                          }
                          openTile(tile);
                        }}
                        title={`${tile.name ? tile.name + ' ' : ''}${alphabet[tile.x]}-${tile.y}`}
                        className="w-full h-full z-40 !pointer-events-auto"
                        src={tile.img}
                      />
                    )}
                    {yidx === 0 && (
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          const maptiles: MapTile[] = map.flat().filter((x) => x !== null) as any;
                          await db.tiles.bulkPut(maptiles.map((tile) => ({ ...tile, y: tile.y + 1 })));
                          const result = await db.tiles.add({
                            map: activemap,
                            x: xidx,
                            y: 0,
                            img: imgSrc,
                          });
                          setmap(
                            produce(map, (draft) => {
                              const newrow = new Array(map[0].length);
                              newrow.fill(null);
                              draft.forEach((row) => {
                                row.forEach((rowtile) => {
                                  if (rowtile) {
                                    rowtile.y += 1;
                                  }
                                });
                              });
                              draft.unshift(newrow);
                              draft[0][xidx] = {
                                id: result,
                                map: activemap,
                                x: xidx,
                                y: 0,
                                img: imgSrc,
                              };
                            })
                          );
                          setmaxY(maxY + 1);
                        }}
                      >
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className={`group absolute h-16 left-0 -top-16 rounded hover:border grid place-items-center hover:bg-slate-100 transition after:hover:content-['Drag_image_here'] text-center`}
                            style={{
                              width: `${tWidth}px`,
                            }}
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="group-hover:hidden font-bold text-xl">{alphabet[xidx]}</span>
                          </div>
                        )}
                      </Dropzone>
                    )}
                    {yidx === maxY - 1 && (
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          const result = await db.tiles.add({
                            map: activemap,
                            x: xidx,
                            y: yidx + 1,
                            img: imgSrc,
                          });

                          setmap(
                            produce(map, (draft) => {
                              const newRow = new Array(map[0].length);
                              newRow.fill(null);
                              newRow[xidx] = {
                                id: result,
                                map: activemap,
                                x: xidx,
                                y: yidx + 1,
                                img: imgSrc,
                              };
                              draft.push(newRow);
                            })
                          );
                          setmaxY(maxY + 1);
                        }}
                      >
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className={`group absolute h-16 left-0 -bottom-16 rounded hover:border grid place-items-center hover:bg-slate-100 transition after:hover:content-['Drag_image_here'] text-center`}
                            style={{
                              width: `${tWidth}px`,
                            }}
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="group-hover:hidden text-xl">+</span>
                          </div>
                        )}
                      </Dropzone>
                    )}
                    {xidx === 0 && (
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          const maptiles: MapTile[] = map.flat().filter((x) => x !== null) as any;
                          await db.tiles.bulkPut(maptiles.map((tile) => ({ ...tile, x: tile.x + 1 })));
                          const result = await db.tiles.add({
                            map: activemap,
                            x: 0,
                            y: yidx,
                            img: imgSrc,
                          });

                          setmap(
                            produce(map, (draft) => {
                              draft.forEach((row) => {
                                row.forEach((rowtile) => {
                                  if (rowtile) {
                                    rowtile.x += 1;
                                  }
                                });
                              });
                              draft.forEach((row) => row.unshift(null));
                              draft[yidx][0] = {
                                id: result,
                                map: activemap,
                                x: 0,
                                y: yidx,
                                img: imgSrc,
                              };
                            })
                          );
                          setmaxX(maxX + 1);
                        }}
                      >
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className={`group absolute w-16 -left-16 top-0 rounded hover:border grid place-items-center hover:bg-slate-100 transition after:hover:content-['Drag_image_here'] text-center`}
                            style={{
                              height: `${tHeight}px`,
                            }}
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="group-hover:hidden font-bold text-xl">{yidx + 1}</span>
                          </div>
                        )}
                      </Dropzone>
                    )}
                    {xidx === maxX - 1 && (
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          const result = await db.tiles.add({
                            map: activemap,
                            x: xidx + 1,
                            y: yidx,
                            img: imgSrc,
                          });

                          setmap(
                            produce(map, (draft) => {
                              draft.forEach((row) => row.push(null));
                              draft[yidx][xidx + 1] = {
                                id: result,
                                map: activemap,
                                x: xidx + 1,
                                y: yidx,
                                img: imgSrc,
                              };
                            })
                          );
                          setmaxX(maxX + 1);
                        }}
                      >
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className={`group absolute w-16 -right-16 top-0 rounded hover:border grid place-items-center hover:bg-slate-100 transition after:hover:content-['Drag_image_here'] text-center`}
                            style={{
                              height: `${tHeight}px`,
                            }}
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span className="group-hover:hidden text-xl">+</span>
                          </div>
                        )}
                      </Dropzone>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </TransformComponent>
      </TransformWrapper>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[80]"
          onClose={() => {
            setIsOpen(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto grid place-items-center">
            <div className="flex min-h-full w-full items-center justify-center p-4 text-center max-w-7xl">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-screen transform overflow-hidden rounded-sm bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="grid grid-cols-6 lg:grid-cols-12 mt-2 gap-4 max-h-[800px]">
                    <span className="absolute bottom-6 right-6 text-slate-800">{`${alphabet[activeTile?.x ?? 0]}-${
                      activeTile?.y
                    }`}</span>

                    <form
                      className="flex w-full flex-col justify-start items-start mb-4 col-span-6 relative"
                      onSubmit={handleSubmit(async (values) => {
                        await db.tiles.update(activeTile!.id!, {
                          name: values.name,
                          notes: values.notes,
                          unsolved: values.unsolved ? 1 : 0,
                        });
                        setmap(
                          produce(map, (draft) => {
                            draft[activeTile!.y!][activeTile!.x!] = {
                              ...activeTile,
                              name: values.name,
                              notes: values.notes,
                              unsolved: values.unsolved ? 1 : 0,
                            } as any;
                          })
                        );
                        setactiveTile({
                          ...activeTile,
                          name: values.name,
                          notes: values.notes,
                          unsolved: values.unsolved,
                        } as any);
                        if (utiles.length > 0) {
                          const unsolvedtiles = await db.tiles.where('unsolved').equals(1).toArray();
                          setutiles(unsolvedtiles);
                        }
                        toast.info('Saved');
                      })}
                      onLoad={() => setFocus('name')}
                    >
                      <span className="text-xs absolute right-0 -top-3 text-gray-600">
                        Drag here to update map image
                      </span>
                      <Dropzone
                        noClick={true}
                        onDrop={async (acceptedFiles) => {
                          const imgSrc = await getImageSrc(acceptedFiles, mulanamode);
                          await db.tiles.update(activeTile!.id!, { img: imgSrc });
                          setactiveTile({ ...activeTile, img: imgSrc } as any);
                          setmap(
                            produce(map, (draft) => {
                              draft[activeTile!.y!][activeTile!.x!]!.img = imgSrc;
                            })
                          );
                          toast.info('Tile image updated');
                        }}
                      >
                        {({ getRootProps }) => (
                          <div className="w-28 transition absolute top-2 right-0 hover:w-full" {...getRootProps()}>
                            <img src={activeTile?.img} className="" alt="" />
                          </div>
                        )}
                      </Dropzone>

                      <label className="mb-2 text-lg font-bold" htmlFor="name">
                        Name
                      </label>
                      <input className="mb-6 w-96" type="text" {...register('name')} defaultValue={activeTile?.name} />
                      <label className="mb-2" htmlFor="notes">
                        Notes
                      </label>
                      <textarea
                        {...register('notes')}
                        className="w-full min-h-[400px] mb-2"
                        defaultValue={activeTile?.notes}
                      />
                      <div className="my-4 flex flex-row items-center">
                        <input {...register('unsolved')} id="unsolved" type="checkbox" />
                        <label className="ml-2 select-none" htmlFor="unsolved">
                          Unsolved
                        </label>
                      </div>

                      <button
                        className="h-10 focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-sm text-sm px-5 py-2.5"
                        type="submit"
                      >
                        Save
                      </button>
                    </form>
                    <div className="col-span-6">
                      <h2 className="mb-2 text-lg font-bold">Images</h2>
                      <div className={`w-full h-[500px] ${tilepics.length > 0 ? 'overflow-y-scroll' : ''}`}>
                        {tilepics.map((pic) => {
                          return (
                            <div className="relative group" key={`tilepic_${pic.id}`}>
                              <Button
                                className="bg-red-600 absolute top-0 right-0 hidden group-hover:flex flex-row items-center"
                                onClick={async () => {
                                  if (confirm('Are you sure?')) {
                                    await db.tilepics.delete(pic.id!);
                                    settilepics(tilepics.filter((x) => x.id !== pic.id));
                                  }
                                }}
                              >
                                <TrashIcon className="w-5 h-5 mr-2" /> Remove
                              </Button>
                              <img className="mb-1" key={pic.id} src={pic.img} />
                            </div>
                          );
                        })}
                        {tilepics.length === 0 && (
                          <div className="w-full h-full flex justify-center items-center text-xs text-gray-500">
                            No images yet
                          </div>
                        )}
                      </div>
                      <Dropzone noClick={true} onDrop={(acceptedFiles) => addTileNote(acceptedFiles)}>
                        {({ getRootProps, getInputProps }) => (
                          <div
                            className="h-[100px] my-4 w-full rounded border grid place-items-center hover:bg-slate-100 transition text-center"
                            {...getRootProps()}
                          >
                            <input {...getInputProps()} />
                            <span>Drop your note image here</span>
                          </div>
                        )}
                      </Dropzone>
                    </div>
                  </div>

                  <div className="mt-4 w-full flex flex-row justify-start">
                    <Button className="flex flex-row items-center mr-2" onClick={() => deleteTile()}>
                      <TrashIcon className="h-5 w-5 mr-2" /> Delete tile
                    </Button>

                    <Button className=" flex flex-row items-center" onClick={() => deleteLinks()}>
                      <TrashIcon className="h-5 w-5 mr-2" /> Delete links
                    </Button>
                  </div>
                  <button className="absolute right-0 top-0 p-3 hover:bg-slate-100" onClick={() => setIsOpen(false)}>
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      <ToastContainer autoClose={2000} />
    </div>
  );
};

export default App;
