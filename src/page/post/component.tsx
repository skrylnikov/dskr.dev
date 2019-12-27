import { h } from 'preact';
import { useMemo } from 'preact/hooks';

import { getPostList } from '../../service/post-list/index';

import { Wrapper, Header, Name, Time, Text } from './style';

interface IProps {
  url?: string;
  path: string;
}

export const PostPage = ({url}: IProps) => {
  const postList: any[] = useMemo(getPostList, []);
  
  const post = postList.filter((x)=>x.url === url)[0];

  if(!post){
    return <Wrapper>404 post not found</Wrapper>;
  }
  
  return (
    <Wrapper className="h-entry single-post">
      <Header>
        <a className="p-author" href="https://dskr.dev"></a>
        <a className="u-url" href={`https://dskr.dev${url}`}></a>
        <Name className="p-name">{post.name}</Name>
        <Time className="dt-published" datetime={post.timeIso}>{post.timeFormat}</Time>
      </Header>
      <Text className="e-content">{post.text}</Text>
    </Wrapper>
  );
}
