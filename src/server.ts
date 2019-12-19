import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';

import { renderApp } from './ssr';
const app = new Koa();

const router = new Router();


router.get(['/', '/p/*', '/ff'], (ctx)=> ctx.body=renderApp(ctx.url));

app.use(Static('./static'));
app.use(Static('./dist'));
app.use(router.routes());

app.listen(8000);
