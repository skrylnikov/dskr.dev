import { readFile } from "node:fs/promises";

const post = await readFile(
  "./src/content/blog/how-to-install-node.mdx",
  "utf-8"
);

const [_, metadata, content] = post.split("---\n");

const partList = content.split("```");

const result: string[] = [];

for (let i = 0; i < partList.length; i++) {
  if (i % 2 === 1) {
    result.push(partList[i]);
  } else {
    const stringList = partList[i].split("\n");

    const resultList: string[] = [];

    for (const str of stringList) {
      if (str.trim().length === 0) {
        resultList.push(str);
        continue;
      }
      const data = await fetch(
        "https://api.cloudflare.com/client/v4/accounts/98a9d47e5b5c05e09498883436cdf820/ai/run/@cf/meta/m2m100-1.2b",
        {
          headers: {
            Authorization: "Bearer ${CF_API_TOKEN}",
          },
          method: "POST",
          body: JSON.stringify({
            text: str,
            source_lang: "ru",
            target_lang: "en",
          }),
        }
      ).then((response) => response.json());

      resultList.push(data?.result?.translated_text?.translated_text || '');
    }

    result.push(resultList.join('\n'));
  }
}


console.log(result.join('```'));
