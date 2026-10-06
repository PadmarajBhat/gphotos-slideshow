/**
 * A TV's built-in browser: Sony's Vewd/Opera, LG, Samsung, Fire TV, Google TV
 * and the like. Used only to keep videos within what TV hardware decoders can
 * show; nothing else about the app changes.
 */
export const TV_BROWSER_PATTERN =
  /BRAVIA|SMART-?TV|SmartTV|GoogleTV|Android TV|AFT[A-Z]|CrKey|Tizen|Web0S|webOS|NetCast|HbbTV|Viera|\bOMI\//i;

export const IS_TV_BROWSER = typeof navigator !== 'undefined' && TV_BROWSER_PATTERN.test(navigator.userAgent);
