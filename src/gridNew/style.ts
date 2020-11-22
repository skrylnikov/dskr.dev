import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled('div')`
  display: grid;
  grid-template-areas: "link-bar explorer main";

  @media(max-width: 1024px){
    grid-template-areas: "explorer" "main" "link-bar";
  }
`;

export const LinkBar = styled('main')`
  height: 100vh;
  width: 4em;
  background-color: #37343E;
  grid-area: link-bar;
  @media(max-width: 1024px){
    width: 100%;
    height: 2em;
    display: flex;
    justify-content: space-around;
    align-items: center;
    position: fixed;
    bottom: 0;
  }
`;

export const Twitter = styled('a')`
  display: block;
  background: url('/svg/twitter.svg');
  width: 3em;
  height: 3em;
  margin: 2em 0.5em;
  background-repeat: no-repeat;
  @media(max-width: 1024px){
    width: 1.8em;
    height: 1.8em;
    margin: 0;
  }
`;

export const Telegram = styled('a')`
  display: block;
  background: url('/svg/telegram.svg');
  width: 3em;
  height: 3em;
  margin: 1em 0.5em;
  background-repeat: no-repeat;
  @media(max-width: 1024px){
    width: 1.8em;
    height: 1.8em;
    margin: 0;
  }
`;

export const Github = styled('a')`
  display: block;
  background: url('/svg/github.svg');
  width: 3em;
  height: 3em;
  margin: 2em 0.5em;
  background-repeat: no-repeat;
  @media(max-width: 1024px){
    width: 1.8em;
    height: 1.8em;
    margin: 0;
  }
`;


export const Main = styled('main')`
  width: calc(100vw - 18em - 4em);
  grid-area: main;
  @media(max-width: 1024px){
    width: 100vw;
  }
`;

export const Content = styled('main')`
  background: #292534;
  height: calc(100vh - 3.5em);
  color: #D8D8DA;
  padding: 1em 3em;
  overflow-y: auto;
  pre {
    margin: 0 1em;
    overflow-y: auto;
  }
  @media(max-width: 1024px){
    height: initial;
    max-height: 100%;
    min-height: calc(100vh - 7em);
    padding: 0 1em;
    padding-bottom: 2.5em;
  }
`;

export const Article = styled('article')`
  flex-grow: 1;
  max-width: minmax(60%, 900px);
  min-width: 20em;
`;
