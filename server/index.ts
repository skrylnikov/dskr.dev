import { createHmac } from 'crypto';

import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';

import { loadContent } from './content';

const app = new Koa();

const router = new Router();
// app.use(parser());

router.post('/hooks/github', (ctx) => {

  const key = createHmac('sha256', process.env.WEBHOOK_TOKEN as string)
    .update(JSON.stringify(ctx.request.body))
    .digest('hex');

  if (ctx.request.headers['x-hub-signature-256'] !== 'sha256=' + key) {
    console.log('bad webhook :(');
    return 404;
  }

  console.log('github webhook!');
  loadContent();
  ctx.body = { status: 'ok' };
})

app.use(router.routes());

app.use(Static('./dist'));

app.listen(8000);

loadContent();
