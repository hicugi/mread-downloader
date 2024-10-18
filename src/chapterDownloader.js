import https from "https";
import path from "path";
import fs from "fs";

import { getArgs, getConfig, setupBrowser, sleep } from "./helper/general.js";

const formatImgLink = (url) => {
  return url.replace(/(#|\?).*$/, "");
};

const downloadImages = async (url, dirPath, config) => {
  const { page, browser, goTo } = await setupBrowser();

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

      const inetrval = setInterval(async () => {
        if (!isBodyReady) return;
        clearInterval(inetrval);

        const imgIndex = images.findIndex((img) => img === imgUrl);

        if (imgIndex === -1) {
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

  if (!config.isDirectDownload) {
    responseCount = images.length;
  }

  isBodyReady = true;
  console.log("Images to download:", images.length);

  if (config.scrollToBottom) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }

  const ATTEMPS_TO_WAIT = 5;
  let attempsCount = 0;
  let prevDownloadedImgCount = 0;
  await new Promise((resolve) => {
    const interval = setInterval(async () => {
      console.log(
        `Waiting for responses... ${responseCount} images left, ${attempsCount} attemps`
      );

      if (responseCount === 0) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (prevDownloadedImgCount !== downloadedImgCount) {
        attempsCount = 0;
      }
      prevDownloadedImgCount = downloadedImgCount;

      if (
        attempsCount <= ATTEMPS_TO_WAIT &&
        downloadedImgCount !== images.length
      ) {
        await sleep(5000);
        attempsCount += 1;
        return;
      }

      clearInterval(interval);
      resolve();
    }, 1000);
  });

  if (downloadedImgCount !== images.length) {
    throw new Error(
      `Some images are missing. Got ${downloadedImgCount} of ${images.length}`
    );
  }

  fs.writeFileSync(`${dirPath}/done`, Buffer.from(String(images.length)));

  await browser.close();
};

export const downloadChapter = async (url, domainConfig) => {
  let dir;

  if (domainConfig.formatChapter) {
    dir = domainConfig.formatChapter(url);
  } else {
    dir = url.replace(/\/$/, "");
    dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");
  }

  const dirPath = path.join(domainConfig.mangaDir, dir);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  if (fs.existsSync(`${dirPath}/done`)) {
    return null;
  }

  await downloadImages(url, dirPath, domainConfig);
  return true;
};

if (process.argv[1].match(/\.js$/)) {
  const [, argUrl] = getArgs();
  const domainConfig = getConfig();

  downloadChapter(argUrl, domainConfig);
}
