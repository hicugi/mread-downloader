import puppeteer from "puppeteer";
import fs from "fs";

const url = "https://manhuaplus.com/manga/tales-of-demons-and-gods01/";
const IMAGE_START_WITH = "https://cdn.manhuaplus.com/";

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

const getImages = async (url, dirPath) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1, height: 1 });

  const images = {};

  page.on("response", async (response) => {
    const fileUrl = response.url();
    const matches = /.*\.(jpg|jpeg|png|gif)$/.exec(fileUrl);

    if (
      matches &&
      matches.length === 2 &&
      fileUrl.startsWith(IMAGE_START_WITH)
    ) {
      images[fileUrl] = await response.buffer();
    }
  });

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

  for (const imgUrl of domLinks) {
    if (!images[imgUrl]) {
      throw new Error(`Image not found: ${imgUrl}`);
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

  for (const chapter of chapters) {
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

    await new Promise((ok) => setTimeout(ok, 500));
  }
})();
