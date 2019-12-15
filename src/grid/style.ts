import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  flex-direction: column;
`;

export const Main = styled<JSX.HTMLAttributes<HTMLDivElement>>('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: row;
  min-height: calc(100vh - 5em);
`;

export const Aside = styled<JSX.HTMLAttributes<HTMLDivElement>>('aside')`
  width: 25%;
`;

export const Article = styled<JSX.HTMLAttributes<HTMLDivElement>>('article')`
  flex-grow: 1;
  max-width: 50%;
`;
