import { h } from 'preact';

import { Wrapper, Links, Me, MeTitle, Img, MeName, MeInfo } from './style';

interface IProps {
}

export const Aside = ({}: IProps) => {
  return (
    <Wrapper className="h-card h-author">
      <Me>
        <MeTitle>
          <Img className="u-photo" src="/img/me.jpeg" />
          <MeInfo>
            <MeName className="p-name">Дмитрий Скрыльников</MeName>
            <p className="p-note">Frontend Developer</p>
          </MeInfo>
        </MeTitle>
      </Me>
      <Links>
        <a href="https://github.com/skrylnikov" rel="me">GitHub</a>
        <a href="https://twitter.com/dskr_dev" rel="me">Twitter</a>
        <a href="https://t.me/dskrylnikov" rel="me">Telegram</a>
        <a href="https://dskr.dev" rel="me" className="u-url"></a>
      </Links>
    </Wrapper>
  );
}

