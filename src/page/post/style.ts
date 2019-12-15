import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  flex-direction: column;
`;

export const Header = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  align-items: center;
`;

export const Name = styled<JSX.HTMLAttributes<HTMLDivElement>>('h2')`
  margin: 0;

  a {
    font-weight: normal;
  }
`;

export const Time = styled<JSX.HTMLAttributes<HTMLTimeElement> & {datetime: Date}>('time')`
  margin-left: 1em;
`;

export const Text = styled<JSX.HTMLAttributes<HTMLDivElement>>('p')``;

