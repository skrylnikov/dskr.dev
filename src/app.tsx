import { h } from 'preact';
import { useState } from 'preact/hooks';
import { setup, glob } from 'goober';
import { Router } from 'preact-router';

import { Grid } from './gridNew/component';

import { MainPage } from './page/main/component';
import { FullFeedPage } from './page/full-feed/component';
import { PostPage } from './page/post/component';

setup(h);

interface IProps {
  url?: string;
}

export const App = ({url}: IProps)=>{
  const [realUrl, setRealUrl] = useState(url || '/');

  return (
    <Grid url={realUrl}>
      <Router url={url} onChange={(s)=>setRealUrl(s.url)}>
        <MainPage path="/"/>
        <FullFeedPage path="/ff"/>
        <PostPage path="/p/:year/:month/:day"/>
      </Router>
    </Grid>
  )
};
