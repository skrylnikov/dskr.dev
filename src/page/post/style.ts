import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  flex-direction: column;
`;

export const Header = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
  display: flex;
  align-items: center;

  @media screen and (max-width: 700px) {
    flex-direction: column;
  }
`;

export const Name = styled<JSX.HTMLAttributes<HTMLDivElement>>('h1')`
  margin: 0;
  font-size: 28px;
  a {
    font-weight: normal;
  }
`;

export const Time = styled<JSX.HTMLAttributes<HTMLTimeElement> & {datetime: string}>('time')`
  margin-left: 1em;
`;

export const Content = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')``;

