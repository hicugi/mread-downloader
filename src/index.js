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
    // waitUntil: "networkidle2",
    waitUntil: "domcontentloaded",
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

  const images = [];
  let downloadedImgCount = 0;

  let isBodyReady = false;
  let responseCount = 0;

  page.on("response", async (response) => {
    const fileUrl = response.url();
    const imgUrl = formatImgLink(fileUrl);

    const matches = /.*\.(jpg|jpeg|png|gif|webp)$/i.exec(imgUrl);

    if (!matches || matches.length !== 2) return;

    responseCount += 1;

    const inetrval = setInterval(async () => {
      if (!isBodyReady) return;
      clearInterval(inetrval);

      const imgIndex = images.findIndex((img) => img === imgUrl);

      if (imgIndex === -1) {
        responseCount -= 1;
        return;
      }

      const filePath = `${dirPath}/${imgIndex + 1}.${imgUrl.substring(
        imgUrl.lastIndexOf(".") + 1
      )}`;
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, await response.buffer(), "base64");
      }

      downloadedImgCount += 1;
      responseCount -= 1;
    }, 300);
  });

  await goTo(page, url);

  const domLinks = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel), (img) =>
        img.getAttribute("src")
      ),
    selector
  );

  for (const link of domLinks) {
    const imgUrl = formatImgLink(link);
    images.push(imgUrl);
  }
  isBodyReady = true;
  console.log("Images to download:", images.length);

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      console.log("Waiting for responses...", responseCount);

      if (responseCount === 0) {
        clearInterval(interval);
        resolve();
      }
    }, 3000);
  });

  if (downloadedImgCount !== images.length) {
    const text = missedImages.map(([img]) => img).join("; ");
    throw new Error(`Next images are missing: ${text}`);
  }

  fs.writeFileSync(`${dirPath}/done`, Buffer.from(String(images.length)));
  await sleep(5000);

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
