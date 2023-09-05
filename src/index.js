import puppeteer from "puppeteer";
import fs from "fs";
import { domain } from "./config.js";

const [, , mainDir, argUrl] = process.argv;

const mainDirPath = `export/${mainDir}`;

const prevInfo = [
  `Parsing from: ${argUrl}`,
  `Exporting to next dir: ${mainDirPath}`,
];
console.log(prevInfo.join("\n"));

fs.mkdirSync(mainDirPath, { recursive: true });

const sleep = (t) => new Promise((ok) => setTimeout(ok, t));

const getPage = async (url, callback) => {
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();
  await page.setViewport({ width: 1, height: 1 });

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  const data = await callback(page);
  await browser.close();

  return data;
};

const formatImgLink = (url) => {
  return url.replace(/(#|\?).*$/, "");
};

const getImages = async (pageUrl, url, dirPath) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1, height: 1 });

  const images = {};

  const responseCallback = async (response) => {
    const fileUrl = response.url();
    const matches = /.*\.(jpg|jpeg|png|gif)$/i.exec(formatImgLink(fileUrl));

    if (matches && matches.length === 2) {
      images[formatImgLink(fileUrl)] = await response.buffer();
    }
  };
  page.on("response", responseCallback);

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  let counter = 0;
  const domLinks = await page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll(selector), (a) =>
        a.getAttribute("src")
      ),
    domain[pageUrl.host].images
  );

  for (const link of domLinks) {
    const imgUrl = formatImgLink(link);
    if (!images[imgUrl]) {
      const msg = `Image not found: ${imgUrl}`;
      console.error(msg);
      throw new Error(msg);
    }

    counter += 1;
    const filePath = `${dirPath}/${counter}.${imgUrl.substring(
      imgUrl.lastIndexOf(".") + 1
    )}`;
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, images[imgUrl], "base64");
    }
  }

  if (counter) {
    fs.writeFileSync(`${dirPath}/done`, Buffer.from(String(counter)));
  }
  await browser.close();
};

(async () => {
  const pageUrl = new URL(argUrl);

  const chapters = await getPage(pageUrl.href, async (page) => {
    return await page.evaluate(
      (selector) =>
        Array.from(document.querySelectorAll(selector), (a) =>
          a.getAttribute("href")
        ),
      domain[pageUrl.host].chapters
    );
  });

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    console.log(
      `${((i + 1) / (chapters.length / 100)).toFixed(2)}% ${chapter}`
    );

    let dir = chapter.replace(/\/$/, "");
    dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");
    const dirPath = `${mainDirPath}/${dir}`;

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    if (fs.existsSync(`${dirPath}/done`)) {
      continue;
    }

    await getImages(pageUrl, chapter, dirPath);
    await sleep(500);
  }
})();
