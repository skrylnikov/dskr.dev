import parse from 'date-fns/parse';
import format from 'date-fns/format';
import formatIso from 'date-fns/formatISO';
import ruLocale from 'date-fns/locale/ru';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import got from 'got';
 
import { Context } from '../../utils/context';

import { IPost, IGetPostList } from './types';

let list: IPost[] = [];

const highlight = (str: string, lang: string) =>{
  if(lang && hljs.getLanguage(lang)){
    try {
      return hljs.highlight(lang, str).value;
    } catch (e) {
      console.error(e);
    }
  }
  return '';
};

interface IRepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  url: string;
}

const githubToken = process.env.GITHUB_TOKEN;

const gotOptions = { headers: { Authorization: 'token ' + githubToken}};

const repoUrl = 'https://api.github.com/repos/skrylnikov/content.dskr.dev';
export const readPostList = async () => {
  try {
    console.log('start update post list');
    
    const newList: IPost[] = [];
    
    const folderList = await got(`${repoUrl}/contents/blog`, gotOptions).json<IRepoFile[]>();

    for(const folder of folderList){
      if(folder.type !== 'dir'){
        continue;
      }

      const fileInfoList = await got(folder.url, gotOptions).json<IRepoFile[]>();

      const fileInfo = fileInfoList.find((x) => x.name === 'README.md');
      if(!fileInfo || !fileInfo.download_url){
        continue;
      }

      const {body: file} = await got(fileInfo.download_url, gotOptions);

      const fileName = fileInfo.path.split('/')[1];

      console.log(fileName);
      const time = parse(fileName, 'yyyy-MM-dd', new Date());
      const md = new MarkdownIt();
      const parsedPost = md.parse(file, {});
      if(parsedPost.length<=3){
        console.error(`Bad post ${fileName}`);
        continue;
      }
      const title = parsedPost[1].content;
      const content = md.renderer.render(parsedPost.slice(3), {highlight}, {});

      newList.push({
        title,
        time: formatIso(time),
        timeFormated: format(time, 'd MMMM', {locale: ruLocale}),
        content,
        url: `/p/${format(time, 'yyyy/MM/dd')}`,
        explorerName: format(time, 'yyyy-MM-dd')  + '.md',
      });

    }

    newList.reverse();

    list = newList;
    console.log('end update post list');
  } catch (e) {
    console.error(e);
  }
};

readPostList();

export const getPostList: IGetPostList = () => {
  const context = Context.getContext();
  
  if(context){
    context.data.postList = list;
  }
  return list;
};