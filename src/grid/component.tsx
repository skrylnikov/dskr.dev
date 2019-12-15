import { h, JSX } from 'preact';

import { Header } from '../header/component';
import { Aside } from '../aside/component';
import { Footer } from '../footer/component';

import { Wrapper, Main, Article } from './style';

interface IProps {
  children: JSX.Element
}

export const Grid = ({children}: IProps) => {
  return (
    <Wrapper>
      <Header/>
      <Main>
        <Aside>aside</Aside>
        <Article>{children}</Article>
      </Main>
      <Footer/>
    </Wrapper>
  );
}
