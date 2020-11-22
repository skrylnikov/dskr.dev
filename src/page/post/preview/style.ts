import { styled } from 'goober';

export const Wrapper = styled('div')`
  position: absolute;
  height: calc(100vh - 2em);
  width: 15em;
  top: 2em;
  right: 1em;
  overflow: hidden;
  filter: opacity(75%);
  cursor: default;

  @media(max-width: 1550px){
    display: none;
  }
`;

export const Header = styled('div')`
`;

export const Name = styled('p')`
  margin: 0;
  font-size: 7px;
  font-weight: 400;
`;

export const Time = styled('p')`
  margin-left: 6em;
  margin: 0;
  font-size: 5px;
  font-weight: 400;
`;

export const Content = styled('div')`
  font-size: 5px;
  img {
    max-width: 100%;
    margin: 1px 0;
    filter: opacity(40%);
  }
  p {
    margin: 1px 0;
  }
  a {
    text-decoration: none;
  }
`;

