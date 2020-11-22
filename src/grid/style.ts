import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

export const Main = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: row;
  min-height: calc(100vh - 5em);

  @media screen and (max-width: 700px) {
    flex-direction: column-reverse;
    margin-top: 1em;
  }
`;

export const Article = styled('article')`
  flex-grow: 1;
  max-width: minmax(60%, 900px);
  min-width: 20em;
`;
