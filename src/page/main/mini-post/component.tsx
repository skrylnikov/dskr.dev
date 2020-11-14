import { h } from 'preact';
import { Link } from 'preact-router';

import { Wrapper, Name, Time } from './style';

interface IProps {
  name: string;
  url: string;
  time: string;
  timeFormat: string;
}
 
export const MiniPost = ({name, url, time, timeFormat}: IProps) => {
  return (
    <Wrapper class="h-entry">
      <Name>
        <Link class="p-name u-url" href={url}>{name}</Link> 
      </Name>
      <Time class="dt-published" datetime={time}>{timeFormat}</Time>
    </Wrapper>
  );
}
