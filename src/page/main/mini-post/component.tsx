import { h } from 'preact';
import { Link } from 'preact-router';
import format from 'date-fns/format';
import formatIso from 'date-fns/formatISO';
import ruLocale from 'date-fns/locale/ru';

import { Wrapper, Name, Time } from './style';

interface IProps {
  name: string;
  url: string;
  time: Date;
}

export const MiniPost = ({name, url, time}: IProps) => {
  return (
    <Wrapper class="h-entry">
      <Name>
        <Link class="p-name u-url" href={url}>{name}</Link> 
      </Name>
      <Time class="dt-published" datetime={formatIso(time)}>{format(time, 'd MMMM', {locale: ruLocale})}</Time>
    </Wrapper>
  );
}
