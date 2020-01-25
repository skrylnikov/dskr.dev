import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { Link } from 'preact-router';

import { getPostList } from '../service/post-list/index';

import { Wrapper, Header, List, Item, FolderIcon, FileIcon, SubList } from './style';

interface IProps {
  url: string;
}

export const Explorer = ({ url }: IProps) => {
  const postList = useMemo(getPostList, []);

  return (
    <Wrapper>
      <Header>
        <a href="/"><h1>DSKR.DEV</h1></a>
      </Header>
      <List>
        <Item active={url === '/'}>
          <Link href="/">
            <FileIcon />
            <p>start_page.tsx</p>
          </Link>
        </Item>
        <Item>
          <FolderIcon />
          <p style={{ cursor: 'default' }}>posts</p>
        </Item>
        <SubList>
          {
            postList.map((post) => (
                <Item active={url === post.url}>
              <Link href={post.url}>
                  <FileIcon />
                  <p>{post.explorerName}</p>
              </Link>
                </Item>
            ))
          }
        </SubList>
          <Item active={url === '/ff'}>
        <Link href="/ff">
            <FileIcon />
            <p>full_feed.tsx</p>
        </Link>
          </Item>
      </List>
    </Wrapper>
  );
}
