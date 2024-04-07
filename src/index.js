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

const setup = async () => {
  const browser = await puppeteer.launch({ headless: true });

  const page = await browser.newPage();
  const session = await page.target().createCDPSession();
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", {
    windowId,
    bounds: {},
    // bounds: { windowState: "minimized" },
  });

  return {
    browser,
    page,
  };
};
const goTo = async (page, url) => {
  return await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });
};

const formatImgLink = (url) => {
  return url.replace(/(#|\?).*$/, "");
};

const getChapters = async (url, selector) => {
  const { page, browser } = await setup();
  await goTo(page, url);

  const data = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel), (a) => a.getAttribute("href")),
    selector
  );

  await browser.close();

  return data;
};

const downloadImages = async (url, selector, dirPath) => {
  const { page, browser } = await setup();

  const images = {};

  const responseCallback = async (response) => {
    const fileUrl = response.url();
    const status = response.status();
    const matches = /.*\.(jpg|jpeg|png|gif|webp)$/i.exec(
      formatImgLink(fileUrl)
    );

    if (matches && matches.length === 2 && status < 300 && status > 399) {
      images[formatImgLink(fileUrl)] = await response.buffer();
    }
  };
  page.on("response", responseCallback);

  await goTo(page, url);

  let counter = 0;
  const domLinks = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel), (img) =>
        img.getAttribute("src")
      ),
    selector
  );
  sleep(10000);

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
  const domainConfig = domain[pageUrl.host];

  const chapters = await getChapters(pageUrl.href, domainConfig.chapters);
  chapters.reverse();

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    console.log(
      `${((i + 1) / (chapters.length / 100)).toFixed(2)}% ${chapter}`
    );

    let dir = chapter.replace(/\/$/, "");
    dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");

    if (domainConfig.formatChapter) {
      dir = domainConfig.formatChapter(dir);
    }

    const dirPath = `${mainDirPath}/${dir}`;

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    if (fs.existsSync(`${dirPath}/done`)) {
      continue;
    }

    await downloadImages(chapter, domainConfig.images, dirPath);
    await sleep(500);
  }
})();
