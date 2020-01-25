import { h, JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { styled } from 'goober';

import { getPostList } from '../../service/post-list/index';

import { PostPage } from '../post/component';

const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
`;

interface IProps {
  path: string;
}

export const FullFeedPage = ({}: IProps) => {
  const postList = useMemo(getPostList, []);

  return (
    <Wrapper className="h-feed">
      {
        postList.map((post)=> (
          <PostPage key={post.url} url={post.url} path={post.url}/>
        ))
      }
    </Wrapper>
  );
}
