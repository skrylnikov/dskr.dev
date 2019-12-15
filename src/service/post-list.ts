import parse from 'date-fns/parse';

export const postList = [
  {
    name: 'Hello world indieweb',
    url: '/p/2019/12/16',
    time: parse('2019-12-16', 'yyyy-MM-dd', new Date()),
    text: 'Hello world!',
  }
];