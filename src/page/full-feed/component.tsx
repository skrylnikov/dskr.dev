import { h, JSX } from 'preact';
import { styled } from 'goober';

import { postList } from '../../service/post-list';

import { PostPage } from '../post/component';

const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
`;

interface IProps {
  path: string;
}

export const FullFeedPage = ({}: IProps) => {
  return (
    <Wrapper className="h-feed">
      kek
      {
        postList.map((post)=> (
          <PostPage key={post.url} url={post.url} path={post.url}/>
        ))
      }
    </Wrapper>
  );
}
