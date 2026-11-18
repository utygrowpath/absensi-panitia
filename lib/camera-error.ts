/**
 * Turn the mixed rejections html5-qrcode produces (DOMException, plain string,
 * or Error) into a message that names the actual cause and the recovery.
 * The library rejects with strings for several paths, so `instanceof Error`
 * alone would hide the reason on mobile.
 */
const RULES: readonly (readonly [RegExp, string])[] = [
  [
    /notallowederror|permission denied|permissiondenied/i,
    "Camera permission denied. Allow camera access for this site, then tap Try again.",
  ],
  [
    /notfounderror|requested device not found|no available video devices|no camera/i,
    "No camera was found on this device.",
  ],
  [
    /notreadableerror|trackstarterror|camera is already in use|could not start video source/i,
    "The camera is in use by another app. Close it, then tap Try again.",
  ],
  [
    /overconstrainederror/i,
    "No camera matches the requested settings. Tap Try again.",
  ],
  [
    /camera streaming not supported|navigator\.mediadevices/i,
    "This browser cannot start the camera.",
  ],
  [/insecure/i, "Camera access needs a secure connection (HTTPS or localhost)."],
];

const FALLBACK =
  "Camera unavailable. Grant permission, or type the code instead.";

/** Describe why the camera failed, for display next to a retry button. */
export function describeCameraError(error: unknown): string {
  if (error == null) return FALLBACK;

  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error);

  if (!text || text === "[object Object]" || text === "undefined") return FALLBACK;

  for (const [pattern, message] of RULES) {
    if (pattern.test(text)) return message;
  }

  return text;
}
