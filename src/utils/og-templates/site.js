import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

export default async () => {
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
          justifyContent: "center",
          alignItems: "center",
          padding: "48px 56px",
          fontFamily: "DM Sans",
        },
        children: [
          {
            type: "p",
            props: {
              style: {
                fontSize: 72,
                fontWeight: "bold",
                fontFamily: "Space Mono",
                color: "#c2185b",
              },
              children: SITE.title,
            },
          },
          {
            type: "p",
            props: {
              style: {
                fontSize: 28,
                color: "#fffcf2",
                marginTop: "16px",
              },
              children: SITE.desc,
            },
          },
          {
            type: "p",
            props: {
              style: {
                fontSize: 24,
                color: "#ccc5b9",
                marginTop: "24px",
              },
              children: new URL(SITE.website).hostname,
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(SITE.title + SITE.desc + SITE.website),
    },
  );
};
