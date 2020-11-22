import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  max-width: 900px;
`;

export const Header = styled('div')`
`;

export const Name = styled('h1')`
  margin: 0;
  font-size: 30px;
  font-weight: 400;
`;

export const Time = styled<JSX.HTMLAttributes<HTMLTimeElement> & {datetime: string}>('time')`
  margin-left: 1em;
  margin: 0;
  font-size: 24px;
  font-weight: 400;
`;

export const Content = styled('div')`
  font-size: 18px;
  img {
    max-width: 100%;
    margin: 10px 0;
    filter: opacity(75%);
    transition: filter 0.5s ease 1s;
    &:hover {
      filter: opacity(100%);
      transition: filter 0.5s ease;
    }
  }
`;

