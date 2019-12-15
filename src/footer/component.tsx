import { h } from 'preact';
import { Link } from 'preact-router';

import { Wrapper } from './style';

interface IProps {
}

export const Footer = ({}: IProps) => {
  return (
    <Wrapper>
      <Link href="/">DSKR.DEV</Link>
    </Wrapper>
  );
}
