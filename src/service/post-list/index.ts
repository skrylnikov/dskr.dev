import { isWeb } from '../../utils';

export const getPostList = (isWeb ? require('./web') : require('./node')).getPostList;
