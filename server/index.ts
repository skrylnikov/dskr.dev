import Koa from 'koa';
import Router from '@koa/router';
import Static from 'koa-static';

import { loadContent } from './content';

const app = new Koa();

const router = new Router();
// app.use(parser());

app.use(Static('./dist'));
app.use(router.routes());

app.listen(8000);

loadContent();
