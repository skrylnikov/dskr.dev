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
