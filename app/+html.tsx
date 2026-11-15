import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo web export.
 * Configures viewport scaling and prevents iOS Safari from auto-zooming on input focus.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveStyles = `
  /* Prevent iOS Safari from zooming in on input focus across mobile views */
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
    outline: none !important;
  }
  input:focus, select:focus, textarea:focus, button:focus,
  input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }
  /* WebKit Autofill: prevent browser from breaking input backgrounds and injecting default blue/black rects */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
    box-shadow: 0 0 0 1000px transparent inset !important;
    -webkit-text-fill-color: inherit !important;
    caret-color: currentColor !important;
    transition: background-color 999999s ease-in-out 0s;
    background-color: transparent !important;
  }
  /* Safe area space at top for iPhone status bar / notch and mobile views */
  @supports (padding-top: env(safe-area-inset-top)) {
    [data-testid="redesign-top-bar"] {
      padding-top: max(env(safe-area-inset-top, 0px), 16px) !important;
    }
  }
`;
