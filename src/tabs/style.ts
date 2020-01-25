import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('main')`
  display: flex;
  height: 1.5em;
  background-color: #3F3B47;
  font-family: 'Pridi', sans-serif;
`;
