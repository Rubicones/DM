import { chapters, type Chapter, type Station } from '@/config/content';

export interface StationEntry {
  station: Station;
  chapter: Chapter;
  chapterIndex: number;
  number: number;
  local: { index: number; count: number };
}

/** Flat, ordered list of stations with chapter context. */
export const stationEntries: StationEntry[] = (() => {
  let n = 0;
  return chapters.flatMap((chapter, chapterIndex) =>
    chapter.stations.map((station, i) => ({
      station,
      chapter,
      chapterIndex,
      number: ++n,
      local: { index: i + 1, count: chapter.stations.length },
    })),
  );
})();

export const stationById = new Map(stationEntries.map((e) => [e.station.id, e]));

/** Deterministic −1…1 per station — drives the sticker tilt of themes with `surface.tilt`. */
export const tiltSeed = (n: number) => Math.round((((n * 9301 + 49297) % 233280) / 233280) * 2000 - 1000) / 1000;

/** "Selected work / N": projects are numbered across the whole site, in reading order. */
export const projectNumber = new Map(
  stationEntries.filter((e) => e.station.kind === 'project').map((e, i) => [e.station.id, i + 1]),
);
