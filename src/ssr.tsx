import { h } from 'preact';
import render from 'preact-render-to-string';
import { extractCss } from 'goober';

import { Context } from './utils/context';

import { App } from './app';

const cache = new Map<string, string>();

const realRender = (url: string) => {
  const context = { data: {}};
  Context.setContext(context);
  const app = render(<App url={url} />);
  const style = extractCss();
  
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
  <style>${style}</style>
</head>
<body>
  <div id="app">${app}</div>
  <script type=""text/javascript>
    window.data = JSON.parse(${JSON.stringify(JSON.stringify(context.data))});
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


