import { h } from 'preact';

import { Wrapper, Links, Me } from './style';

interface IProps {
}

export const Aside = ({}: IProps) => {
  return (
    <Wrapper>
      <Me class="h-card h-author">
        <p class="p-name">Дмитрий Скрыльников</p>
      </Me>
      <Links>
        <a href="https://github.com/skrylnikov" rel="me">GitHub</a>
        <a href="https://twitter.com/dskr_dev" rel="me">Twitter</a>
        <a href="https://t.me/dskrylnikov" rel="me">Telegram</a>
      </Links>
    </Wrapper>
  );
}

