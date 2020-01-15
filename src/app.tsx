import { h } from 'preact';
import { setPragma, glob } from 'goober';
import { Router, Link } from 'preact-router';

import { Grid } from './grid/component';

import { MainPage } from './page/main/component';
import { FullFeedPage } from './page/full-feed/component';
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
        <FullFeedPage path="/ff"/>
        <PostPage path="/p/:year/:month/:day"/>
      </Router>
    </Grid>
  )
};
