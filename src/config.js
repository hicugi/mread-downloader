export const domain = {
  "manhuaplus.com": {
    chapters: ".wp-manga-chapter a[href]",
    images: ".chapter-video-frame img",
  },
  "chapmanganato.com": {
    chapters: ".row-content-chapter a[href]",
    images: ".container-chapter-reader > img",
  },
  "manganato.com": {
    chapters: ".row-content-chapter a[href]",
    images: ".container-chapter-reader > img",
  },
  "coffeemanga.io": {
    chapters: ".wp-manga-chapter a[href]",
    images: ".reading-content .page-break > img",
  },
  "greatestestatedeveloper.com": {
    chapters: ".su-expand-content .su-posts a",
    images: "#main .separator img",
    formatChapter: (chapter) => {
      const res = chapter.match(/^\d+[\w-]+?(\d.*)/);
      return res ? res[1] : chapter;
    },
  },
};
