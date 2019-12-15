import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('aside')`
  width: 20%;
`;

export const Links = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  flex-direction: column;
  width: inherit;
`;

export const Me = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`

`;
