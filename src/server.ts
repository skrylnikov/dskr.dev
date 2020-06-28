import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';

import { renderApp } from './ssr';
const app = new Koa();

const router = new Router();


router.get(['/', '/p/:id*', '/ff'], (ctx)=> {
//router.get(['/'], (ctx)=> {
    console.time('renderApp');
    const result = renderApp(ctx.url);
    console.timeEnd('renderApp');
    ctx.body = result;
  });

app.use(Static('./static'));
app.use(Static('./dist'));
app.use(router.routes());

app.listen(8000);
