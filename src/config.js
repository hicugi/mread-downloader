export const domain = {
  // en
  "manhuaplus.com": {
    chapters: ".wp-manga-chapter a[href]",
    images: ".chapter-video-frame img",
  },
  "chapmanganato.com": {
    chapters: ".row-content-chapter a[href]",
    images: ".container-chapter-reader > img",
  },
  "chapmanganato.to": {
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
      const res = chapter.match(/chapter-(.+?)\//);
      return res ? res[1] : chapter;
    },
  },
  "www.webtoons.com": {
    chapters: ".detail_lst ul a",
    pagination: ".paginate a",
    paginationMatch: /page=/,

    formatChapter: (chapter) => {
      const res = chapter.match(/episode-(\d+)/);
      return res ? res[1] : chapter;
    },

    images: "#_imageList img",
    scrollToBottom: true,
  },
  "ww2.jujustukaisen.com": {
    chapters: "#Chapters_List > * ul li a[href]",
    images: "main .entry-content img[src^=http]",

    formatChapter: (chapter) => {
      const v = chapter
        .split("/")
        .at(-2)
        .match(/chapter-(.+)$/);
      return v ? v[1] : v;
    },
    scrollToBottom: true,
  },
  "w33.jujmanga.com": {
    chapters: "#Chapters_List > * ul li a[href]",
    images: "main .entry-content img[src^=http]",

    formatChapter: (chapter) => {
      const v = chapter
        .split("/")
        .at(-2)
        .match(/chapter-(.+)$/);
      return v ? v[1].replace(/-2$/, "") : v;
    },
    scrollToBottom: true,
  },

  // ru
  "remanga.org": {
    chapters: "[class^='Chapters_container'] a[href]",
    images: "main [class^='Image_placeholder'] #chapter-image",
  },
  "readmanga.live": {
    chapters: "#chapters-list a[href]",
    images: "#fotocontext .manga-img-placeholder > img[src]",
    isDirectDownload: true,

    formatChapter: (link) => {
      return link.replace(/.+vol/, "").replace("/", "-");
    },
    getImagesFn: async (page) => {
      const html = await page.content();

      const BEFORE = "readerDoInit(";
      let content = html.substring(html.indexOf(BEFORE) + BEFORE.length);
      content = content.substring(content.indexOf("["));
      content = content.substring(0, content.indexOf("]]") + 2);

      let items;
      eval(`items = ${content}`);

      return items.map((el) => el[0] + el[2]);
    },
  },
};
