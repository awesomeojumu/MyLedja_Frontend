import { Platform } from 'react-native';

/**
 * Prevents iOS Safari and mobile WebKit from auto-zooming into inputs on focus.
 * iOS WebKit automatically zooms when an input has font-size < 16px
 * or when viewport meta allows scaling on focus.
 */
export function setupPreventIosZoom() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // 1. Ensure viewport meta tag disables auto-zoom scaling
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  );

  // 2. Inject global CSS rule ensuring inputs never trigger iOS zoom
  const styleId = 'prevent-ios-input-zoom';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @supports (-webkit-touch-callout: none) {
        input, select, textarea {
          font-size: 16px !important;
        }
      }
      @media screen and (max-width: 768px) {
        input, select, textarea {
          font-size: 16px !important;
        }
      }
      input, select, textarea, button {
        touch-action: manipulation;
      }
    `;
    document.head.appendChild(style);
  }
}
