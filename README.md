# nlsmdn

Personal blog at [nlsmdn.com](https://nlsmdn.com), built with [Astro](https://astro.build) and [AstroPaper](https://github.com/satnaing/astro-paper).

## Development

```bash
bun install
bun run dev      # localhost:4321
bun run build    # production build
```

Draft posts can be previewed at their `/posts/...` URL during `bun run dev`.
They remain excluded from production builds, feeds, and post listings.

## Blog media

Inline images and GIFs **match the text column width**: currently 736 CSS pixels
on desktop, shrinking with the column on smaller screens. Use a `blog-media`
figure with an explicit aspect ratio around the image; set the image's `width`
and `height` to its source dimensions.

Export GIFs at least 960 pixels wide from the original video. Prefer 1920-pixel
stills for sharp display. Preserve the chosen animation timing and
the shot's aspect ratio. Exclude black letterbox bars from the visible frame.

For the /guide post, the GIF is 960 × 408 at 45% speed. The 1920 × 1080 Gandalf
still uses a 1920:804 figure and centered `object-fit: cover` to hide its 138-pixel
top and bottom bars, displaying at about 736 × 308 on desktop. Local files live in
`public/images/blog/skill-showcase-guide/`.

The producer's sizing convention and handoff are saved in
`~/wrksp/assets/docs/blog-media.md`; export recipes live in that repo's
`docs/recipes.md`.
