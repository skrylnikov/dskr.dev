import { h, JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { styled } from 'goober';

import { getPostList } from '../../service/post-list/index';

import { PostPage } from '../post/component';

const Wrapper = styled('div')`
`;

interface IProps {
  path: string;
}

export const FullFeedPage = ({}: IProps) => {
  const postList = useMemo(getPostList, []);

  return (
    <Wrapper class="h-feed">
      {
        postList.map((post)=> (
          <PostPage key={post.url} url={post.url} path={post.url} isPreview={false}/>
        ))
      }
    </Wrapper>
  );
}
