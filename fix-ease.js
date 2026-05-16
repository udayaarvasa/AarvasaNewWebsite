const fs = require("fs");
const path = require("path");

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes("node_modules") && !filePath.includes(".next")) {
        filelist = walkSync(filePath, filelist);
      }
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
      filelist.push(filePath);
    }
  });
  return filelist;
};

const files = walkSync(path.join(__dirname, "src"));

let replacedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  if (content.match(/ease:\s*\[[\d\.\s,]+\]/)) {
    const newContent = content.replace(/(ease:\s*\[[\d\.\s,]+\])/g, '$1 as any');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent);
      replacedCount++;
      console.log(`Updated ${file}`);
    }
  }
});

console.log(`Updated ${replacedCount} files.`);
