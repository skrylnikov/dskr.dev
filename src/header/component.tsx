import { h } from 'preact';

import { Wrapper, Title } from './style';

interface IProps {
}

export const Header = ({}: IProps) => {
  return (
    <Wrapper>
      <Title>
        <a class="u-url" rel="me" href="https://dsk.dev">DSKR.DEV</a> 
      </Title>
    </Wrapper>
  );
}
