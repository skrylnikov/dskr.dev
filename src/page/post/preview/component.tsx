import { h } from 'preact';
import { useMemo, useEffect } from 'preact/hooks';

import { IPost } from '../../../service/post-list/types';

import { Wrapper, Header, Name, Time, Content } from './style';

interface IProps {
  post: IPost;
}

export const Preview = ({post}: IProps) => {

  if(!post){
    return null;
  }
  
  return (
    <Wrapper>
      <Header>
        <Name >// {post.title}</Name>
        <Time>// {post.timeFormated}</Time>
      </Header>
      <Content children={null} dangerouslySetInnerHTML={{__html: post.content}}/>
    </Wrapper>
  );
}
