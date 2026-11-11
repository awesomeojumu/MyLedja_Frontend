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
  }
`;
