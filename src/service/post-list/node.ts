import parse from 'date-fns/parse';

import format from 'date-fns/format';
import formatIso from 'date-fns/formatISO';
import ruLocale from 'date-fns/locale/ru';

import { Context } from '../../utils/context';

export const getPostList = () => {
  console.log('getPostList node');

  const context = Context.getContext();
  console.log(context);

  const time = parse('2019-12-16', 'yyyy-MM-dd', new Date());

  
  const postList = [
    {
      name: 'Hello world indieweb',
      url: '/p/2019/12/16',
      time: parse('2019-12-16', 'yyyy-MM-dd', new Date()),
      timeIso: formatIso(time),
      timeFormat: format(time, 'd MMMM', {locale: ruLocale}),
      text: 'Hello world! Это первый пост в индивебе',
    }
  ];
  if(context){
    context.data.postList = postList;
  }
  return postList;
};