import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              height: 100%;
              margin: 0;
              padding: 0;
              background-color: #FFFFFF;
            }
            /* Eliminate native browser focus outline rectangles */
            input, textarea, select, button {
              outline: none !important;
            }
            input:focus, textarea:focus, select:focus, button:focus,
            input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible {
              outline: none !important;
              box-shadow: none !important;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
