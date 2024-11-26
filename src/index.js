import fs from "fs";
import path from "path";

import {
  getArgs,
  getConfig,
  getFullLink,
  getMangaDir,
  setupBrowser,
  sleep,
} from "./helper/general.js";
import { downloadChapter } from "./chapterDownloader.js";

const [, argUrl, argParam] = getArgs();

const mainDirPath = getMangaDir();
const chaptersTempPath = path.join(mainDirPath, "chapters.json");

const prevInfo = [
  `Parsing from: ${argUrl}`,
  `Exporting to next dir: ${mainDirPath}`,
];
console.log(prevInfo.join("\n"));

fs.mkdirSync(mainDirPath, { recursive: true });

const getChapters = async (url, domainConfig) => {
  if (domainConfig.paginationMatch && fs.existsSync(chaptersTempPath)) {
    return JSON.parse(fs.readFileSync(chaptersTempPath));
  }

  const getChapterLinks = async (url) => {
    const { page, browser, goTo } = await setupBrowser();
    await goTo(page, url);

    const data = await page.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(sel), (a) =>
          a.getAttribute("href")
        ),
      domainConfig.chapters
    );

    await new Promise((ok) => {
      const interval = setInterval(() => {
        if (data.length !== 0) {
          clearInterval(interval);
          ok();
        }
      }, 300);
    });

    await browser.close();

    return data.map((v) => getFullLink(v, domainConfig.origin));
  };

  if (!domainConfig.pagination) {
    return getChapterLinks(url);
  }

  const pages = [url];
  const memoPages = {};
  const result = new Set();

  console.log("\nStarting to read pages...");

  const getPaginationLinks = async (url) => {
    const { page, browser, goTo } = await setupBrowser();
    await goTo(page, url);

    const data = await page.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(sel), (a) =>
          a.getAttribute("href")
        ),
      domainConfig.pagination
    );

    await browser.close();

    return data
      .filter((link) => link.match(domainConfig.paginationMatch))
      .map((v) => getFullLink(v, domainConfig.origin));
  };

  while (pages.length) {
    const pageUrl = pages.shift();

    if (memoPages[pageUrl]) {
      continue;
    }
    memoPages[pageUrl] = true;

    console.log(`- reading page: ${pageUrl}`);

    const chapterLinks = await getChapterLinks(pageUrl);
    for (const link of chapterLinks) {
      result.add(link);
    }

    const nextPageLinks = await getPaginationLinks(pageUrl);
    pages.push(...nextPageLinks);
  }

  const arrResult = Array.from(result);

  if (domainConfig.paginationMatch) {
    fs.writeFile(
      chaptersTempPath,
      JSON.stringify(arrResult, null, 2),
      () => {}
    );
  }

  return arrResult;
};

(async () => {
  const domainConfig = getConfig();

  const chapters = await getChapters(domainConfig.url.href, domainConfig);
  // chapters.reverse();

  let isActivated = argParam.after === undefined;
  if (!isActivated) console.log(`Skip everything before ${argParam.after}`);

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    console.log(
      `${((i + 1) / (chapters.length / 100)).toFixed(2)}% ${chapter}`
    );

    isActivated = isActivated || chapter.includes(argParam.after);
    if (!isActivated) continue;

    await downloadChapter(chapter, domainConfig);

    if (argParam.before && chapter.includes(argParam.before)) break;
  }
})();
