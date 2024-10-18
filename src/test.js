import fs from "fs";
import path from "path";

import { getMangaDir } from "./helper/general.js";

const mainDir = getMangaDir();

console.log(`Manga dir: ${mainDir}`);

const items = fs.readdirSync(mainDir).filter((d) => d[0] !== ".");

const format = (d) => {
  const ar = d.split("-");
  if (ar.length === 1) {
    return Number(d);
  }

  return ar[0] + ar[1] / 100000;
};
items.sort((a, b) => format(b) - format(a));

items.forEach((dir) => {
  const chapterPath = path.join(mainDir, dir);
  const donePath = path.join(chapterPath, "done");

  if (!fs.existsSync(donePath)) {
    console.log("================================");
    console.log(`${chapterPath} Unfinhed chapter ${dir}`);
    console.log("================================");
    return;
  }

  const itemsCount = fs.readdirSync(chapterPath).length;
  console.log(
    `${chapterPath} Finished chapter ${dir} with ${itemsCount} images`
  );
});
