import { h, Fragment } from 'preact';
import { useMemo, useEffect } from 'preact/hooks';

import { getPostList } from '../../service/post-list/index';

import { Preview } from './preview/component';

import { Wrapper, Header, Name, Time, Content } from './style';

interface IProps {
  url?: string;
  path: string;
  isPreview: boolean;
}

export const PostPage = ({ url, isPreview }: IProps) => {
  const postList = useMemo(getPostList, []);

  const post = postList.filter((x) => x.url === url)[0];

  if (!post) {
    return <Wrapper>404 post not found</Wrapper>;
  }

  return (
    <Fragment>
      <Wrapper class="h-entry single-post">
        <Header>
          <a class="p-author" href="https://dskr.dev"></a>
          <a class="u-url" href={`https://dskr.dev${url}`}></a>
          <Name class="p-name">// {post.title}</Name>
          <Time class="dt-published" datetime={post.time}>// {post.timeFormated}</Time>
        </Header>
        <Content children={null} class="e-content" dangerouslySetInnerHTML={{ __html: post.content }} />
      </Wrapper>
      {isPreview && <Preview post={post} />}
    </Fragment>
  );
}
