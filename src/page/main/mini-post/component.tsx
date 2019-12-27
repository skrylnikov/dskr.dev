import { h } from 'preact';
import { Link } from 'preact-router';

import { Wrapper, Name, Time } from './style';

interface IProps {
  name: string;
  url: string;
  time: Date;
  timeIso: string;
  timeFormat: string;
}

export const MiniPost = ({name, url, time, timeIso, timeFormat}: IProps) => {
  return (
    <Wrapper className="h-entry">
      <Name>
        <Link className="p-name u-url" href={url}>{name}</Link> 
      </Name>
      <Time className="dt-published" datetime={timeIso}>{timeFormat}</Time>
    </Wrapper>
  );
}
