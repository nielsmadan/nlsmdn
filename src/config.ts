export const SITE = {
  website: "https://nlsmdn.com/",
  author: "Niels Madan",
  profile: "https://nlsmdn.com/about",
  desc: "Personal blog of Niels Madan",
  title: "nlsmdn",
  ogImage: "",
  lightAndDarkMode: true,
  postPerIndex: 10,
  postPerPage: 10,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
  showBackButton: true,
  editPost: {
    enabled: true,
    text: "Edit on GitHub",
    url: "https://github.com/nielsmadan/nlsmdn/edit/main/web/",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "en",
  timezone: "Europe/Berlin",
} as const;
