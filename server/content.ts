import * as fs from 'fs';
import * as http from 'isomorphic-git/http/node';
import { mkdir, opendir, readFile, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';

import Git from 'isomorphic-git';
import Yaml from 'yaml';

import { contentDir, blogDir } from './config';

export const loadContent = async () => {
  const isContentDirExist = fs.existsSync(contentDir);

  if (!isContentDirExist) {
    await Git.clone({
      fs,
      http,
      dir: contentDir,
      url: 'https://github.com/skrylnikov/content.dskr.dev.git',
    });
  } else {
    await Git.pull({
      fs,
      http,
      dir: contentDir,
      author: { name: 'dskrylnikov', email: 'skrylnikovd@ya.ru' },
    });
  }

  if (fs.existsSync(blogDir)) {
    await rm(blogDir, { recursive: true });
  }

  await mkdir(blogDir);

  const contentBlogDir = resolve(contentDir, 'blog');

  const dir = await opendir(contentBlogDir);
  for await (const dirent of dir) {
    if (dirent.isDirectory()) {
      const filePath = resolve(contentBlogDir, dirent.name, 'README.md');
      const file = await readFile(filePath, { encoding: 'utf-8' });

      const parsedFile = file.split('---');


      parsedFile[1] = "\nsetup: |\n  import Layout from '../../layouts/BlogPost.astro'" + parsedFile[1];

      const meta = Yaml.parse(parsedFile[1]);

      console.log(meta);


      await writeFile(resolve(blogDir, meta.url + '.md'), parsedFile.join('---'), { encoding: 'utf-8' })
    }
  }



};
