import { h } from 'preact';
import { Link } from 'preact-router';
import { format } from 'date-fns';
import ruLocale from 'date-fns/locale/ru';

import { postList } from '../../service/post-list';

import { Wrapper, Header, Name, Time, Text } from './style';

interface IProps {
  url?: string;
  path: string;
}

export const PostPage = ({url}: IProps) => {
  const post = postList.filter((x)=>x.url === url)[0];

  if(!post){
    return <Wrapper>404 post not found</Wrapper>;
  }
  
  return (
    <Wrapper class="h-entry single-post">
      <Header>
        <a class="u-author" href="/"></a>
        <Name class="p-name">{post.name}</Name>
        <Time class="dt-published" datetime={post.time}>{format(post.time, 'd MMMM', {locale: ruLocale})}</Time>
      </Header>
      <Text class="p-content">{post.text}</Text>
    </Wrapper>
  );
}
