import { h } from 'preact';

import { Wrapper, Links, Me, MeTitle, Img, MeName, MeInfo } from './style';

interface IProps {
}

export const Aside = ({}: IProps) => {
  return (
    <Wrapper class="h-card h-author">
      <Me>
        <MeTitle>
          <Img class="u-photo" src="/img/me.jpeg" />
          <MeInfo>
            <MeName class="p-name">Дмитрий Скрыльников</MeName>
            <p class="p-note">Frontend Developer</p>
          </MeInfo>
        </MeTitle>
      </Me>
      <Links>
        <a href="https://github.com/skrylnikov" rel="me">GitHub</a>
        <a href="https://twitter.com/dskr_dev" rel="me">Twitter</a>
        <a href="https://t.me/dskrylnikov" rel="me">Telegram</a>
        <a href="https://dskr.dev" rel="me" class="u-url"></a>
      </Links>
    </Wrapper>
  );
}

