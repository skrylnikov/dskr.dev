import { h, JSX } from 'preact';

import { Header } from '../header/component';
import { Aside } from '../aside/component';
import { Footer } from '../footer/component';

import { Explorer } from '../explorer/component';
import { Tabs } from '../tabs/component'; 

import { Wrapper, Main, Content, LinkBar, Twitter, Telegram, Github } from './style';

interface IProps {
  children: JSX.Element;
  url: string;
}

export const Grid = ({ children, url }: IProps) => {
  return (
    <Wrapper>
      <LinkBar>
        <Telegram children={null} href="https://t.me/dskrylnikov" rel="me" alt="Telegram" title="Telegram" />
        <Github children={null} href="https://github.com/skrylnikov" rel="me" alt="Github" title="Github" />
        <Twitter children={null} href="https://twitter.com/dskr_dev" rel="me" alt="Twitter" title="Twitter" />
      </LinkBar>
      <Explorer url={url}/>
      <Main>
        <Tabs/>
        <Content>{children}</Content>
      </Main>
    </Wrapper>
  );
}
