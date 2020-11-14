import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled('aside')`
  width: 20em;
`;

export const Links = styled('div')`
  display: flex;
  flex-direction: column;
  width: inherit;
`;

export const Me = styled('div')`
`;

export const MeTitle = styled('div')`
  display: flex;
  height: 5em;
`;

export const Img = styled<JSX.HTMLAttributes<HTMLImageElement>>('img')`
  width: 5em;
  margin-right: 1em;
`;

export const MeName = styled('p')`
  font-weight: bold;
`;

export const MeInfo = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  width: 12em;

  p {
    margin: 0;
  }
`
