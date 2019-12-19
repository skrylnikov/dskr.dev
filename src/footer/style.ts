import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('footer')`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

