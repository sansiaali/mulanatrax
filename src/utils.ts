import { TileLink } from './db';

export function seededRandomColor(seed: string) {
  let res = 0;

  for (let i = 0; i < seed.length; ++i) res = res * 10 + seed[i].charCodeAt(0) - '0'.charCodeAt(0);
  return '#' + Math.floor(Math.abs(Math.sin(res) * 16777215) % 16777215).toString(16);
}

export const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export async function readFileAsDataURL(file: File): Promise<string> {
  let result_base64: string = await new Promise((resolve) => {
    let fileReader = new FileReader();
    fileReader.onload = (e) => resolve(fileReader.result as string);
    fileReader.readAsDataURL(file);
  });

  return result_base64;
}

export async function getImageSrc(files: File[]) {
  const file = files[0];
  const result = await readFileAsDataURL(file);
  return result;
}

export function drawLinks(links: TileLink[]) {
  const c: HTMLCanvasElement = document.getElementById('linecanvas') as any;
  const ctx = c.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, c.width, c.height);
  links.forEach((link) => {
    const fromTile = document.getElementById(`tile_${link.from}`);
    const toTile = document.getElementById(`tile_${link.to}`);
    if (fromTile && toTile) {
      ctx.beginPath();
      ctx.moveTo(fromTile?.offsetLeft + link.fromOffsetX, fromTile?.offsetTop + link.fromOffsetY);
      ctx.lineTo(toTile?.offsetLeft + link.toOffsetX, toTile?.offsetTop + link.toOffsetY);
      ctx.strokeStyle = seededRandomColor(`${link.from} + ${link.to}`);
      ctx.lineWidth = 5;
      ctx.shadowColor = 'gray';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.stroke();
      ctx.closePath();
    }
  });
}

export const fuseOptions = {
  keys: ['name', 'notes'],
  findAllMatches: true,
  threshold: 0.7,
  ignoreLocation: true,
  useExtendedSearch: true,
};
