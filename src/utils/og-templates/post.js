import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

export default async (post) => {
  const date = new Date(post.data.pubDatetime).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return satori(
    {
      type: "div",
      props: {
        style: {
          background: "#252422",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          fontFamily: "DM Sans",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
              children: [
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: 52,
                      fontWeight: "bold",
                      fontFamily: "Space Mono",
                      color: "#c2185b",
                      lineHeight: 1.2,
                      maxHeight: "280px",
                      overflow: "hidden",
                    },
                    children: post.data.title,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: 22,
                      color: "#ccc5b9",
                    },
                    children: date,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: 26,
                      color: "#fffcf2",
                      lineHeight: 1.4,
                      maxHeight: "140px",
                      overflow: "hidden",
                    },
                    children: post.data.description,
                  },
                },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: "100%",
                      height: "1px",
                      background: "#403d39",
                    },
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 24,
                      color: "#ccc5b9",
                    },
                    children: [
                      {
                        type: "span",
                        props: {
                          children: `by ${post.data.author}`,
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: { fontFamily: "Space Mono" },
                          children: SITE.title,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(
        `${post.data.title}${post.data.description}${post.data.author}${SITE.title}${date}by`,
      ),
    },
  );
};
