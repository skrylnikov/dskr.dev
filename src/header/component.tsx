import { h } from 'preact';
import { Link } from 'preact-router';

import { Wrapper, Title } from './style';

interface IProps {
}

export const Header = ({}: IProps) => {
  return (
    <Wrapper>
      <Title>
        <Link href="/">DSKR.DEV</Link> 
      </Title>
    </Wrapper>
  );
}
