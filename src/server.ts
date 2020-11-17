import { config } from 'dotenv';
import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';
import parser from 'koa-bodyparser';
import { createHmac } from 'crypto';

config();

import { readPostList } from './service/post-list/node';
import { renderApp } from './ssr';
const app = new Koa();

const router = new Router();
app.use(parser());

router.post('/hooks/github', (ctx) => {
  
  const key = createHmac('sha256', process.env.WEBHOOK_TOKEN as string)
  .update(JSON.stringify(ctx.request.body))
  .digest('hex');
  
  if (ctx.request.headers['x-hub-signature-256'] !== 'sha256=' + key) {
    console.log('bad webhook :(');
    return 404;
  }

  console.log('github webhook!');
  readPostList();
  ctx.body = { status: 'ok' };
})

router.get(['/', '/p/:id*', '/ff'], (ctx) => {
  console.time('renderApp');
  const result = renderApp(ctx.url);
  console.timeEnd('renderApp');
  ctx.body = result;
});

app.use(Static('./static'));
app.use(Static('./dist'));
app.use(router.routes());

app.listen(8000);
