import * as fs from 'fs';
import * as http from 'isomorphic-git/http/node';
import { mkdir, opendir, readFile, rm, writeFile, copyFile } from 'fs/promises';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

import Git from 'isomorphic-git';
import Yaml from 'yaml';
import { last } from 'remeda';

import { contentDir, blogDir, publicDir } from './config';
import 'pri'

const imageReg = /\.(gif|jpg|jpeg|png|webp)$/i;

const assetsDir = resolve(publicDir, 'assets');


const loadImg = async (dirPath: string) => {
  const dir = await opendir(dirPath);

  const result: Array<[string, string]> = [];

  for await (const dirent of dir) {
    if (dirent.isDirectory()) {
      continue
    };
    if (!imageReg.test(dirent.name)) {
      continue;
    }

    const ext = last(dirent.name.split('.'));

    const hash = createHash('sha256');

    const hashName = hash.digest('hex').slice(0, 20);


    await copyFile(resolve(dirPath, dirent.name), resolve(assetsDir, hashName + '.' + ext));

    result.push([`(./${dirent.name})`, `(/assets/${hashName}.${ext})`]);
  }

  return result;
};

export const loadContent = async () => {
  console.log('start load content');

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

  if (fs.existsSync(assetsDir)) {
    await rm(assetsDir, { recursive: true });
  }
  await mkdir(assetsDir);

  const contentBlogDir = resolve(contentDir, 'blog');

  const dir = await opendir(contentBlogDir);
  for await (const dirent of dir) {
    if (dirent.isDirectory()) {
      const filePath = resolve(contentBlogDir, dirent.name, 'README.md');
      const file = await readFile(filePath, { encoding: 'utf-8' });

      const parsedFile = file.split('---');


      // parsedFile[1] = "\nsetup: |\n  import Layout from '../../layouts/BlogPost.astro'" + parsedFile[1];

      const meta = Yaml.parse(parsedFile[1]);

      meta.setup = "import Layout from '../../layouts/BlogPost.astro'";
      meta.github = `https://github.com/skrylnikov/content.dskr.dev/blob/main/blog/${dirent.name}/README.md`;

      parsedFile[1] = '\n' + Yaml.stringify(meta);

      const parsedContent = parsedFile[2].split('\n');

      parsedFile[2] = parsedContent.slice(parsedContent.findIndex((x) => x.includes('# ')) + 1).join('\n');

      const assetList = await loadImg(resolve(contentBlogDir, dirent.name));

      assetList.forEach(([source, target]) => {
        parsedFile[2] = parsedFile[2].replace(source, target);
      })

      await writeFile(resolve(blogDir, meta.url + '.md'), parsedFile.join('---'), { encoding: 'utf-8' })
    }
  }

  console.log('load content successfull');


  execSync('pnpm build')

  console.log('build successfull 🎉');
};
