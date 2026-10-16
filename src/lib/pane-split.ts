import { twoColumn, type WidthClass } from "./nav-mode";

/** Whether WidePane splits. `tablet` screens (list-plus-detail on the boards) also split on a landscape tablet. */
export function paneSplits(widthClass: WidthClass, portrait: boolean, tablet: boolean): boolean {
  if (twoColumn(widthClass, portrait)) return true;
  return tablet && !portrait && widthClass === "medium";
}

/** Side column width: narrower on a tablet so the detail keeps room. */
export function sideColumnWidth(widthClass: WidthClass): number {
  return widthClass === "medium" ? 300 : 360;
}
