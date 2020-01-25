import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
`;

export const LinkBar = styled<JSX.HTMLAttributes<HTMLDivElement>>('main')`
  height: 100vh;
  width: 4em;
  background-color: #37343E;
`;

export const Twitter = styled<JSX.HTMLAttributes<HTMLDivElement>>('a')`
  display: block;
  background: url('/svg/twitter.svg');
  width: 3em;
  height: 3em;
  margin: 2em 0.5em;
  background-repeat: no-repeat;
`;

export const Telegram = styled<JSX.HTMLAttributes<HTMLDivElement>>('a')`
  display: block;
  background: url('/svg/telegram.svg');
  width: 3em;
  height: 3em;
  margin: 1em 0.5em;
  background-repeat: no-repeat;
`;

export const Github = styled<JSX.HTMLAttributes<HTMLDivElement>>('a')`
  display: block;
  background: url('/svg/github.svg');
  width: 3em;
  height: 3em;
  margin: 2em 0.5em;
  background-repeat: no-repeat;
`;


export const Main = styled<JSX.HTMLAttributes<HTMLDivElement>>('main')`
  width: calc(100vw - 15em - 4em);
`;

export const Content = styled<JSX.HTMLAttributes<HTMLDivElement>>('main')`
  background: #292534;
  height: calc(100vh - 3.5em);
  color: #D8D8DA;
  padding: 1em 3em;
  overflow-y: auto;
  pre {
    margin: 0 1em;
  }
`;

export const Article = styled<JSX.HTMLAttributes<HTMLDivElement>>('article')`
  flex-grow: 1;
  max-width: 60%;
  min-width: 20em;
`;
