# DSKR.DEV: как я пришёл к preact и SSR

Активность matinintim.com в декабре заставила меня задуматься о написании собственного блога. Идея витала давно, но тут появился отличный повод. Домен и сервер уже были, и я решил начать писать. 
Изначально я планировал использовать node.js и какой-нибудь шаблонизатор для рендеринга html на стороне сервера, но посмотрев на десяток популярных шаблонизаторы, я заплакал и понял что без jsx жить больше не могу. Вариантов с jsx я нашёл всего два. Один из них был генератором из jsx в html, то что нужно! Правда он не дружил с typescript, что было критично для меня. А второй был просто react'ом на бэкенде. Тогда-то я и понял что в любом случае придётся брать preact, ибо react слишком жирный. И надо будет делать сразу с SSR, ибо индивеб без SSR не работает.
К счастью, прикрутить SSR к preact оказалось совсем не сложно.
В первой итерации я решил использовать parcel для сборки фронтенда, так как это самый простой вариант.
Ноду запускал используя ts-node-dev. На ноде решил писать на koa, ибо express немного надоел. 
Я уже привык к отсутствию body-parser'а в express'е, но то что в koa не будет роутера я совсем не ожила. Но это мелочи. 
Нода также раздаёт статику, и в проде и в деве. Вышло как-то так. Файл назвал `server.ts`
```typescript

import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';

import { renderApp } from './ssr';
const app = new Koa();

const router = new Router();


router.get(['/', '/p/*'], (ctx)=> ctx.body=renderApp(ctx.url));

app.use(Static('./dist'));
app.use(router.routes());

app.listen(4000);
```
Здесь я поднимаю koa сервер, раздающий статику и вызывающий функцию рендерящую фронтенд часть приложения. 

Само preact приложение я написал в файле app.tsx 
```jsx
import { h } from 'preact';
import { setPragma } from 'goober';
import { Router, Link } from 'preact-router';

import { Grid } from './grid/component';

import { MainPage } from './page/main/component';
import { PostPage } from './page/post/component';

setPragma(h);

interface IProps {
  url?: string;
}

export const App = ({url}: IProps)=>{


  return (
    <Grid>
      <Router url={url}>
        <MainPage path="/"/>
        <PostPage path="/p/:year/:month/:day"/>
      </Router>
    </Grid>
  )
};
```
В целом здесь ничего интересного, обычной preact, обычный роутер, которому можно передать текущий url через пропсы для правильной работы на сервере. Я использую новенькую библиотека для css in js `goober`, у неё очень маленький рантайм, минималистичный api и она умеет в SSR.

Дальше я написал файл ssr.tsx который выполняет всю магию серверсайд рендеринга:
```jsx
import { h } from 'preact';
import render from 'preact-render-to-string';
import { extractCss } from 'goober';

import { App } from './app';

const cache = new Map<string, string>();

const realRender = (url: string) => {
  const app = render(<App url={url} />);
  const style = extractCss();

  return `<!DOCTYPE html>
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
  <script src="/web.js"></script>
</body>
</html>
`;
};

export const renderApp = (url: string) => {
  if(cache.has(url)) {
    return cache.get(url);
  }
  const app = realRender(url);
  process.nextTick(() =>cache.set(url, app));
  return app;
};
```
Функция `realRender` собственно и выполняет сам рендеринг, там ничего сложного, используем `preact-render-to-string` для рендеринга html, `extractCss` для получения стилей из `goober`, а дальше вставляется всё в html.

Ну а функция `renderApp` тупо кэширует результат функции `realRender`. Так как рендер preact приложения, даже такого маленького, не такая уж и простая задача и занимает 200—300 мс. А так мы выполняем рендер один раз, а дальше отдаёт готовый html, учитывая что это блог, это идеальное решение.

А точку входа в веб-приложение я разместил в файле web.tsx
```jsx 

import { h, render } from "preact";
import { App } from "./app";

render(<App />, document.body, document.getElementById("app") || undefined);
```

Я просто рендерю preact приложение.

В результате я получил простейшее приложение на preact с SSR, css in js и typescript. Ну а в следующих частях я расскажу как я добавил стейт, научился парсить markdown, подсвечивать синтаксис в блоках кодах, и поднял свой micropub server (Надеюсь, я когда-нибудь и это смогу сделать).
