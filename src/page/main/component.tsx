import { h, JSX } from 'preact';
import { styled } from 'goober';

import { postList } from '../../service/post-list';

import { MiniPost } from './mini-post/component';

const Wrapper = styled<JSX.HTMLAttributes<HTMLDivElement>>('div')`
`;

interface IProps {
  path: string;
}

export const MainPage = ({}: IProps) => {
  return (
    <Wrapper className="h-feed">
      {
        postList.map((post)=> (
          <MiniPost key={post.url} name={post.name} time={post.time} url={post.url}/>
        ))
      }
    </Wrapper>
  );
}
