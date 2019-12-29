import { IGetPostList } from './types';
export const getPostList: IGetPostList = (process.env.WEB ? require('./web') : require('./node')).getPostList;
