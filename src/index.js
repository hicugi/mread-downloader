import puppeteer from "puppeteer";
import fs from "fs";

const url = "https://manhuaplus.com/manga/tales-of-demons-and-gods01/";

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

const getImages = async (url, dirPath) => {
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
  const domLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".chapter-video-frame img"), (a) =>
      a.getAttribute("src")
    )
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
  const chapters = await getPage(url, async (page) => {
    return await page.evaluate(() =>
      Array.from(document.querySelectorAll(".wp-manga-chapter a[href]"), (a) =>
        a.getAttribute("href")
      )
    );
  });

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    console.log(
      `${((i + 1) / (chapters.length / 100)).toFixed(2)}% ${chapter}`
    );

    let dir = chapter.replace(/\/$/, "");
    dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");
    const dirPath = `./export/${dir}`;

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    if (fs.existsSync(`${dirPath}/done`)) {
      continue;
    }

    await getImages(chapter, dirPath);
    await sleep(500);
  }
})();
