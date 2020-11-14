import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

export const Header = styled('div')`
`;

export const Name = styled('h1')`
  margin: 0;
  font-size: 28px;
  font-weight: 400;
`;

export const Time = styled<JSX.HTMLAttributes<HTMLTimeElement> & {datetime: string}>('time')`
  margin-left: 1em;
  margin: 0;
  font-size: 28px;
  font-weight: 400;
`;

export const Content = styled('div')``;

