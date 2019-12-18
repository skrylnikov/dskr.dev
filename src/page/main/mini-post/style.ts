import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  align-items: center;
`;

export const Name = styled<JSX.HTMLAttributes<HTMLDivElement>>('h3')`
  margin: 0;

  a {
    font-weight: normal;
  }
`;


export const Time = styled<JSX.HTMLAttributes<HTMLTimeElement> & {datetime: string}>('time')`
  margin-left: 1em;
`;

