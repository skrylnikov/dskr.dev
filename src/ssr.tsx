import { h } from 'preact';
import render from 'preact-render-to-string';
import { extractCss } from 'goober';

import { Context } from './utils/context';

import { App } from './app';

const cache = new Map<string, string>();


const globalStyle = `
@font-face {
  font-family: 'Pridi';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/Pridi-400.woff2') format('woff2'),
       url('/fonts/Pridi-400.woff') format('woff');
}

@font-face {
  font-family: 'Pridi';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/Pridi-700.woff2') format('woff2'),
       url('/fonts/Pridi-700.woff') format('woff');
}



@font-face {
  font-family: 'Oxygen Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/Oxygen-Sans-400.woff2') format('woff2'),
       url('/fonts/Oxygen-Sans-400.woff') format('woff');
       unicode-range:
}

@font-face {
  font-family: 'Oxygen Sans';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/Oxygen-Sans-700.woff2') format('woff2'),
       url('/fonts/Oxygen-Sans-700.woff') format('woff');
       unicode-range:
}


body {
  font-family: 'Oxygen Sans', sans-serif;
}
`;

const realRender = (url: string) => {
  const context = { data: {}};
  console.time('setContext');
  Context.setContext(context);
  console.timeEnd('setContext');
  console.time('render');
  const app = render(<App url={url} />);
  console.timeEnd('render');
  console.time('extractCss'); 
  const style = extractCss();
  console.timeEnd('extractCss');
  console.time('stringify data');
  const data = JSON.stringify(JSON.stringify(context.data));
  console.timeEnd('stringify data');

  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>DSKR.DEV</title>
  <link rel="microsub" href="https://aperture.p3k.io/microsub/448">
  <link rel="authorization_endpoint" href="https://indieauth.com/auth">
  <link rel="token_endpoint" href="https://tokens.indieauth.com/token">
  <link rel="preload" href="/fonts/Oxygen-Sans-400.woff2"
      as="font" type="font/woff2"
      crossorigin>
  <link rel="preload" href="/fonts/Oxygen-Sans-700.woff2"
      as="font" type="font/woff2"
      crossorigin>
  <style>${globalStyle}</style>
  <style>${style}</style>
</head>
<body>
  <div id="app">${app}</div>
  <script type=""text/javascript>
    window.data = JSON.parse(${data});
  </script>
  <script src="/web.js"></script>
</body>
</html>
`;
};

export const renderApp = realRender
/*
export const renderApp = (url: string) => {
  if(cache.has(url)) {
    return cache.get(url);
  }
  const app = realRender(url);
  process.nextTick(() =>cache.set(url, app));
  return app;
};*/


