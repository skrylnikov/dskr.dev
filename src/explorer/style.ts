import { JSX } from 'preact';
import { styled } from 'goober';


export const Wrapper = styled('main')`
  display: flex;
  height: 100vh;
  width: 18em;
  flex-direction: column;
  background-color: #3F3B47;
  font-family: 'Pridi', sans-serif;
  color: #D8D8DA;
  grid-area: explorer;

  a {
    color: #D8D8DA;
    text-decoration: none;
  }
  @media(max-width: 1024px){
    height: 3em;
    width: 100%;
  }
`;

export const Header = styled('div')`
  background-color: #55515E;
  width: 100%;
  height: 4em;

  h1 {
    text-align: center;
    margin: 0;
    font-size: 40px;
    font-weight: 600;
  }
`;

export const List = styled('div')`
  font-size: 18px;
  margin: 1em 0.5em;
  @media(max-width: 1024px){
    display: none;
  }
`;

export const SubList = styled('div')`
  margin: 0 0.5em;
`;

export const Item = styled<JSX.HTMLAttributes<HTMLDivElement> & { active?: boolean }>('div')`
  display: flex;
  align-items: center;
  width: 100%;
  a {
    display: flex;
    align-items: center;
    transition: background 300ms ease;
    background-color: ${(props) => props.active ? '#2B5AAD' : 'auto'};
    width: 100%;
    height: 32px;
    &:hover, &:focus {
      background-color: rgba(43, 90, 173, 0.7);
      outline: none;
    }
  }

  p {
    margin: 0;
  }
`;

export const FolderIcon = styled('div')`
  display: block;
  background: url('/svg/folder-open.svg');
  width: 1em;
  height: 1em;
  margin: 0.4em;
  background-repeat: no-repeat;

`;

export const FileIcon = styled('div')`
  display: block;
  background: url('/svg/file.svg');
  width: 0.9em;
  height: 0.9em;
  margin: 0.4em;
  background-repeat: no-repeat;
`;