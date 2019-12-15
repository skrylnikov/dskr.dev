import { JSX } from 'preact';
import { styled } from 'goober';

export const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('header')`

`;

export const Title = styled<JSX.HTMLAttributes<HTMLDivElement>>('h1')`
  margin: 0;

  a {
    color: black;
    text-decoration: none;
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 1px;
  }
`;
