import { resolve } from 'path';


export const rootDir: string = process.env.PWD || '';

export const contentDir = resolve(rootDir, 'content');
export const publicDir = resolve(rootDir, 'public');

export const blogDir = resolve(rootDir, 'client', 'pages', 'post');
