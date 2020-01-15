import { h } from 'preact';
import render from 'preact-render-to-string';
import { extractCss } from 'goober';

import { Context } from './utils/context';

import { App } from './app';

const cache = new Map<string, string>();

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
  console.time('result string');
  const result =`
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
      window.data = JSON.parse(${data});
    </script>
    <script src="/web.js"></script>
  </body>
  </html>
  `;
  console.timeEnd('result string');

  
  return result;
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


