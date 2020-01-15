import { readdir, readFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import parse from 'date-fns/parse';
import format from 'date-fns/format';
import formatIso from 'date-fns/formatISO';
import ruLocale from 'date-fns/locale/ru';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
 
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

const readPostList = async () => {
  try {
    const fileList = await promisify(readdir)('./post');
    console.log(fileList);

    for(const fileName of fileList) {
      const fileNameParsed = fileName.split('.');
      if(fileNameParsed.length!==2 || fileNameParsed[1] !=='md'){
        continue;
      }
      const timeString = fileNameParsed[0];
      console.log(fileName);
      const time = parse(timeString, 'yyyy-MM-dd', new Date());
      const file = await promisify(readFile)(resolve('./post', fileName), { encoding: 'utf-8' });
      const md = new MarkdownIt();
      const parsedPost = md.parse(file, {});
      if(parsedPost.length<=3){
        console.error(`Bad post ${fileName}`);
        continue;
      }
      const title = parsedPost[1].content;
      const content = md.renderer.render(parsedPost.slice(3), {highlight}, {});

      list.push({
        title,
        time: formatIso(time),
        timeFormated: format(time, 'd MMMM', {locale: ruLocale}),
        content,
        url: `/p/${format(time, 'yyyy/MM/dd')}`,
      });
    }

    list.reverse();
    
  } catch (e) {
    console.error('err');
    console.error(e);
  }

  
}

readPostList();

export const getPostList: IGetPostList = () => {
  const context = Context.getContext();
  
  if(context){
    context.data.postList = list;
  }
  return list;
};