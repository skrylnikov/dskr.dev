import { h } from 'preact';

import { Wrapper, Title } from './style';

interface IProps {
}

export const Header = ({}: IProps) => {
  return (
    <Wrapper>
      <Title>
        <a href="/">DSKR.DEV</a> 
      </Title>
    </Wrapper>
  );
}
