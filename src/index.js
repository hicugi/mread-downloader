import puppeteer from "puppeteer";
import fs from "fs";
import https from "https";
import { domain } from "./config.js";

const OPEN_BROWSER = false;
const NETWORK_PARPAM =
  // "networkidle2";
  "domcontentloaded";

let [, , mainDir, argUrl] = process.argv;
if (argUrl[0] === '"') {
  argUrl = argUrl.substring(1, argUrl.length - 1);
}

const mainDirPath = `export/${mainDir}`;

const prevInfo = [
  `Parsing from: ${argUrl}`,
  `Exporting to next dir: ${mainDirPath}`,
];
console.log(prevInfo.join("\n"));

fs.mkdirSync(mainDirPath, { recursive: true });

const sleep = (t) => new Promise((ok) => setTimeout(ok, t));

const setup = async () => {
  const browser = await puppeteer.launch({ headless: OPEN_BROWSER === false });

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
    waitUntil: NETWORK_PARPAM,
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

const downloadImages = async (url, dirPath, config) => {
  const { page, browser } = await setup();

  let images = [];
  let downloadedImgCount = 0;

  let isBodyReady = false;
  let responseCount = 0;

  if (config.isDirectDownload) {
    responseCount = 1;

    const inetrval = setInterval(() => {
      if (!isBodyReady) return;
      clearInterval(inetrval);

      responseCount = images.length;

      for (let imgUrl of images) {
        const imgIndex = images.findIndex((img) => img === imgUrl);

        const fileName = formatImgLink(imgUrl);
        const filePath = `${dirPath}/${imgIndex + 1}${fileName.substring(
          fileName.lastIndexOf(".")
        )}`;

        https.get(imgUrl, (res) => {
          const fileStream = fs.createWriteStream(filePath);
          res.pipe(fileStream);

          res.on("end", () => {
            downloadedImgCount += 1;
            responseCount -= 1;
            fileStream.close();
          });
        });
      }
    }, 300);
  } else {
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
  }

  await goTo(page, url);

  const domLinks = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel), (img) =>
        img.getAttribute("src")
      ),
    config.images
  );

  if (config.getImagesFn !== undefined) {
    images = await config.getImagesFn(page);
  } else {
    for (const link of domLinks) {
      const imgUrl = formatImgLink(link);
      images.push(imgUrl);
    }
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
    throw new Error(
      `Some images are missing. Got ${downloadedImgCount} of ${images.length}`
    );
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
    let chapter = chapters[i];

    if (!chapter.match(/^https?\:\/\//)) {
      chapter = `${pageUrl.origin}/${chapter.replace(/^\//, "")}`;
    }

    console.log(
      `${((i + 1) / (chapters.length / 100)).toFixed(2)}% ${chapter}`
    );

    let dir;

    if (domainConfig.formatChapter) {
      dir = domainConfig.formatChapter(chapter);
    } else {
      dir = chapter.replace(/\/$/, "");
      dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");
    }

    const dirPath = `${mainDirPath}/${dir}`;

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    if (fs.existsSync(`${dirPath}/done`)) {
      continue;
    }

    await downloadImages(chapter, dirPath, domainConfig);
    await sleep(500);
  }
})();
