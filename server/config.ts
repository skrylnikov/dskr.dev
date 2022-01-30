import { resolve } from 'path';


export const rootDir: string = process.env.PWD || '';

export const contentDir = resolve(rootDir, 'content');

export const blogDir = resolve(rootDir, 'client', 'pages', 'post');
