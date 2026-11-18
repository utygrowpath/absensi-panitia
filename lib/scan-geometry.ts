/**
 * The scanner decodes a canvas as wide as the reader element's CSS width, so a
 * phone-sized container (≈360px) downscales a 1280px camera stream by ~3.5x and
 * drops the detail a small printed QR needs. Keep the reader at a fixed decode
 * width and scale it down visually instead: `clientWidth` ignores transforms,
 * so the canvas stays at full stream resolution while the preview still fits.
 */

/** Layout width of the decode surface. Matches the requested 1280px stream. */
export const DECODE_WIDTH = 1280;

export type ScanGeometry = {
  /** Multiplier that shrinks the decode surface to the panel width. */
  scale: number;
  /** Panel height in px, or null while there is no video to size against. */
  height: number | null;
  /** Inline min-height; empty string lets the placeholder min-height apply. */
  minHeight: string;
};

/**
 * Size the panel so the scaled surface fills it exactly. An exact match keeps
 * the aiming brackets centred on the video rather than floating off it.
 */
export function computeScanGeometry(
  decodeWidth: number,
  panelWidth: number,
  contentHeight: number,
): ScanGeometry {
  if (decodeWidth <= 0 || panelWidth <= 0) {
    return { scale: 1, height: null, minHeight: "" };
  }

  const scale = panelWidth / decodeWidth;
  if (contentHeight <= 0) {
    return { scale, height: null, minHeight: "" };
  }

  return { scale, height: Math.round(contentHeight * scale), minHeight: "0px" };
}
