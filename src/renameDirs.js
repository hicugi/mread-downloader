import path from "path";
import fs from "fs";

const dir = path.join("export", "Tower-of-god");

for (let i = 82; i < 338; i++) {
  const oldDir = path.join(dir, "" + i);
  const newDir = path.join(dir, "2-" + i);

  fs.renameSync(oldDir, newDir);
}
