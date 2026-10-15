/** Rise runs on web. Skip only when the person asked for reduce motion. */
export function shouldSkipRise(reduceMotion: boolean): boolean {
  return reduceMotion;
}
