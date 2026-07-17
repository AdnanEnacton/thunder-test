# Thunder CMS Integration Plan — Zeepay (Astro)

> Grounded in the actual repo at `C:\Development\AD\zeepay-main` (git remote:
> `https://github.com/AdnanEnacton/thunder-test.git`, branch `master`, already pushed) and the
> actual Thunder CMS source at `C:\Development\AD\sitepins-clone`. Nothing here is generic —
> every path, component, and prop name below is real.

---

## 0. TL;DR — key decisions

| Decision | Answer | Why |
|---|---|---|
| Block tier to use | **Local blocks** (`import.from`), not the `@thunder/blocks-marketing` npm package | Your project has **no React** (`@astrojs/react` isn't installed) — the npm block pack ships React-only components today. Native `.astro` components with a typed `Props` interface is the correct, zero-extra-dependency path. |
| Discovery scope | Only page-*section* components become blocks | Chrome (`Header`, `Footer`, `Navbar`…), forms, and collection-rendering cards (`BlogCard`…) are **not** page blocks — see §5 for why and how they're excluded. |
| `componentsRoot` | `src/components/blocks` (new folder, see §5) | Keeps blocks physically separate from chrome/forms/content-cards so the scanner only ever sees real blocks. |
| Content collections | `blog` and `video-library` need **zero changes** | Already plain frontmatter + Markdown body — Thunder edits these today. |
| Biggest gotcha | **`Hero.astro` and `Review.astro` exist twice** (`homepage/` and `contactpage/`) | Thunder's block key is derived from **filename only**, not folder — both would collide on the same key and silently overwrite each other. Must rename before connecting (§5.2). |
| Media root | `public/img`, **not** `public/images` | Thunder's Astro default guess is `public/images`; this repo uses `public/img`. Override it in the setup wizard (§7). |
| Page routing | One `src/pages/[...slug].astro` catch-all over a `pages` content collection | Mirrors the repo's existing `blog/[...slug].astro` pattern. Replaces `index.astro`/`pricing.astro`/`contact.astro`. A new page created in Thunder needs **zero code changes** to go live — see §9. |

---

## 1. What's actually in this repo (audit)

```
zeepay-main/
├── astro.config.mjs        Astro 6, mdx + sitemap + robots-txt, Tailwind v4 via Vite plugin — no React
├── src/
│   ├── components/         25 .astro files, flat + 5 subfolders, ZERO have a Props interface today
│   │   ├── homepage/       Hero, Features, HowWorks, Review, FAQ, CTA
│   │   ├── contactpage/    Hero, Review, FormContact          ← name collisions with homepage/
│   │   ├── pricingpage/    Plan, Table, Brands
│   │   ├── blogpage/       BannerCTA, Subscribe, BlogCard, BlogVideoPosts, VideoPostCard
│   │   ├── forms/          LoginForm, RegisterForm
│   │   └── Header, Footer, Navbar, Drawer, Logo, SVG, SEO, FormattedDate, HeaderLink  (site chrome)
│   ├── content/
│   │   ├── blog/           8 files (4 real + 4 accidental "*copy.md" duplicates — clean up first)
│   │   └── video-library/  4 files
│   ├── layouts/             Base, Main, BlogPost
│   └── pages/
│       ├── index.astro      hardcodes <Hero /><Features /><HowWorks /><Review /><FAQ /><CTA />
│       ├── pricing.astro    hardcodes <Plan /><Brands /><Table /><Review /><CTA />
│       └── contact.astro    hardcodes <Hero /><Review /><CTA />
└── public/img/               brands/ bg/ comments/ home/ auth/ icons/  (NOT public/images)
```

**The core fact driving this whole plan:** every page today is a fixed stack of hardcoded
`<Component />` imports with no data — literally zero props anywhere in the codebase. To get
anything editable in Thunder, each target component needs a typed `Props` interface *and* the
three homepage/pricing/contact pages need to become data-driven (`blocks[]`) instead of
hardcoded JSX-like stacks. That refactor is 80% of the real work in this plan; connecting the
repo to Thunder itself is the easy 20%.

---

## 2. How Thunder CMS will see this repo (mechanics)

Thunder CMS (`C:\Development\AD\sitepins-clone`) is a headless, Git-backed CMS — it never runs
your site. The flow, grounded in the actual source:

1. `detectFramework()` (`apps/web/src/lib/framework.ts`) sees `astro.config.mjs` in the tree →
   framework = `astro`.
2. The setup wizard (`apps/web/src/components/setup-wizard.tsx`) commits `.thunder/config.json`
   to your repo with your content/media roots.
3. `lib/blocks/discover.ts` — a thin `@babel/parser` reader — opens each `.astro` file under your
   configured `componentsRoot`, extracts the frontmatter fence (between the `---` markers), and
   looks for an `interface Props { ... }` (or `type Props = { ... }`). It maps each member to a
   `BlockFieldDef` (§4 has the exact type-mapping rules).
4. Accepted components become entries in the project's block registry, shown in the page-builder
   palette (`components/content/page-builder/`).
5. Editing a page writes to that page's Markdown/JSON frontmatter as `blocks: [{ _template: "hero", ... }, ...]`
   and **commits straight to your GitHub repo** — same file, same Git history, no Thunder database
   involved in the content itself.
6. Your Astro site renders those blocks via a generated `Blocks.astro` (§9) that maps
   `_template` → the real component. Thunder can generate and commit this file for you.

No Thunder runtime dependency ships to your site — it's your own Astro build, same as today.

---

## 3. Pre-flight cleanup (do this before connecting the repo)

1. **Delete the accidental duplicate blog posts** — `src/content/blog/p1 copy.md` through
   `p4 copy.md` are byte-for-byte near-duplicates of `p1.md`–`p4.md`. Left in place, they'll show
   up as 4 extra confusing entries in Thunder's content list.
   ```
   git rm "src/content/blog/p1 copy.md" "src/content/blog/p2 copy.md" "src/content/blog/p3 copy.md" "src/content/blog/p4 copy.md"
   ```
2. **Decide where blog/video-library hero images live.** Today `heroImage` in frontmatter points
   at `src/assets/...jpg` (e.g. `src/content/blog/p1.md` → `heroImage: "../../assets/b1.jpg"`).
   Thunder's Media Library (browse/upload/copy-path) only manages files under your configured
   `media.root` (`public/img` here) — it can't browse into `src/assets/`. Two options:
   - **Recommended:** move existing hero images into `public/img/blog/` and
     `public/img/video-library/`, update the frontmatter paths, and update `BlogCard.astro`
     (`<Image src={post.data.heroImage} ...>`) to expect a public path (a plain string) instead of
     a `src/assets` import path. New posts created in Thunder will then use its media picker
     end-to-end.
   - **Or:** leave `src/assets` as-is and accept that editors type the image path by hand instead
     of using the media picker for this one field. Works today, just less convenient.

---

## 4. Component → props audit (the core deliverable)

Every `.astro` file under `src/components/`, what it is today, what it becomes, and the exact
`Props` interface to add. Field-type mapping follows Thunder's actual heuristics in
`apps/web/src/lib/blocks/discover.ts::refineStringType()`:

| Key name contains/ends with | Inferred field type |
|---|---|
| `image`, `cover`, `thumbnail`, `src`, `icon` | `image` (media picker) |
| `url`, `href`, `link` | `url` |
| `description`, `content`, `body`, `paragraph`, `excerpt` | `text` (textarea) |
| anything else `string` | `string` (single line) |
| `string[]` | `tags` |
| array of `{ ... }` object literal | `array` of `object` (repeatable card editor) |
| union of string literals (`"a" \| "b"`) | `select` with those options |
| plain nested `{ ... }` | `object` (nested field group) |

**Naming rule for every interface below: name it `Props` (not `HeroProps` etc.) so
`findPropsDeclaration()` matches it directly without ambiguity.**

### 4.1 → Become blocks (move into `src/components/blocks/`, see §5)

| File → new path | Today | Target `Props` | Notes |
|---|---|---|---|
| `homepage/Hero.astro` → `blocks/Hero.astro` | Fully hardcoded | see 4.1.1 | used once, on Home |
| `homepage/Features.astro` → `blocks/Features.astro` | Hardcoded, 2 image-led + 4 icon-led cards in a fixed asymmetric grid | see 4.1.2 | **named-slot props, not an array** — see note |
| `homepage/HowWorks.astro` → `blocks/HowWorks.astro` | Hardcoded, 3 uniform steps | see 4.1.3 | array — uniform repeatable card |
| `homepage/Review.astro` → `blocks/Review.astro` | Hardcoded Swiper carousel, 4 testimonials | see 4.1.4 | keep the Swiper JS, just feed it from props |
| `homepage/FAQ.astro` → `blocks/FAQ.astro` | Hardcoded `const faqs = [...]` array + JSON-LD | see 4.1.5 | JSON-LD must be recomputed from the prop, not the old const |
| `homepage/CTA.astro` → `blocks/CTA.astro` | Hardcoded | see 4.1.6 | **reused on Home, Pricing, Contact** — one block, three placements |
| `contactpage/Hero.astro` → `blocks/ContactHero.astro` | Hardcoded, 3 contact-method cards | see 4.1.7 | **renamed** — collides with homepage Hero otherwise |
| `contactpage/Review.astro` → `blocks/ContactReview.astro` | Hardcoded, 4-card grid (no Swiper) | see 4.1.8 | **renamed** — collides with homepage Review otherwise |
| `pricingpage/Plan.astro` → `blocks/Plan.astro` | Hardcoded 3 plans × monthly/yearly tab toggle | see 4.1.9 | **medium refactor** — template must loop over `plans[]` twice (once per tab) instead of hand-written markup |
| `pricingpage/Brands.astro` → `blocks/Brands.astro` | Hardcoded repeating `<img>` strip | see 4.1.10 | |
| `blogpage/BannerCTA.astro` → `blocks/BannerCTA.astro` | Hardcoded, CSS background-image in a class | see 4.1.11 | background image needs to move from Tailwind class to an inline style bound to the prop |
| `blogpage/Subscribe.astro` → `blocks/Subscribe.astro` | Hardcoded heading/body, real `<form>` | see 4.1.12 | keep the form markup as-is, only heading/body become props |

### 4.2 → Stay code-only (not CMS blocks)

| File | Why it's excluded |
|---|---|
| `pricingpage/Table.astro` | 8-row × 3-plan comparison table with mixed value types (text vs. checkmark icon). Modeling this cleanly as fields is disproportionate effort for a table that rarely changes. Leave as code; revisit only if you actually need to edit it often. |
| `contactpage/FormContact.astro`, `forms/LoginForm.astro`, `forms/RegisterForm.astro` | Functional forms (name/email/validation attributes), not marketing copy. Move `FormContact.astro` to `src/components/forms/` (§5) so it isn't swept into the block scan. |
| `blogpage/BlogCard.astro`, `blogpage/BlogVideoPosts.astro`, `blogpage/VideoPostCard.astro` | Already driven by real data — `getCollection('blog')` / `getCollection('video-library')` entries via a `post` prop. These render *content*, not page composition; the actual editable content is the Markdown files in `src/content/blog/` and `src/content/video-library/`, which Thunder already edits with zero changes (§6). |
| `Header`, `Footer`, `Navbar`, `Drawer`, `Logo`, `SVG`, `SEO`, `FormattedDate`, `HeaderLink` | Site chrome / utilities, not page sections. Stay at `src/components/` top level, outside `componentsRoot`. |

### 4.1.1 — `blocks/Hero.astro` (homepage)

```ts
interface Props {
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  trustedCount: string;        // "500+"
  brands: { src: string }[];   // logo strip — each item's `src` key → image picker
  heroImage: string;           // the big right-hand photo
}

const {
  heading, subheading, primaryCtaLabel, primaryCtaHref,
  secondaryCtaLabel, secondaryCtaHref, trustedCount, brands, heroImage,
} = Astro.props;
```
Replace the hardcoded `<h1>`, `<p>`, both `<a>` buttons, the "Trusted by 500+" text, the 4
hardcoded `<Image>` brand logos (loop `brands.map(...)` instead), and the final `<Image>` with
these values.

### 4.1.2 — `blocks/Features.astro` (homepage)

The current layout is **hand-arranged, not a uniform grid** — 2 large image-led cards in specific
grid cells plus 4 small icon-led cards elsewhere. An array prop would force you to also encode
grid position per item, which is more complex than the content is worth. **Named-slot props**
keep the exact visual layout and are a much smaller diff:

```ts
interface Props {
  sectionHeading: string;
  feature1Image: string; feature1Title: string; feature1Body: string;   // "Multi Currency Support"
  feature2Image: string; feature2Title: string; feature2Body: string;   // "Effortless Integration"
  feature3Title: string; feature3Body: string;                          // "Safe & Secure" (icon kept as sprite)
  feature4Title: string; feature4Body: string;                          // "Transparency"
  feature5Title: string; feature5Body: string;                          // "Speed"
  feature6Title: string; feature6Body: string;                          // "Experience"
}
```
The 4 small cards keep their existing `<use xlink:href="#i1">` sprite icons unchanged (not made
editable) — only title/body become props. If you want icon swapping later, add
`feature3Icon?: string` etc. and map to a `select` of the sprite IDs you have (`i1`–`i4`).

### 4.1.3 — `blocks/HowWorks.astro` (homepage)

```ts
interface Step {
  image: string;
  badge: string;   // "Step 1"
  title: string;
  body: string;
}
interface Props {
  heading: string;
  steps: Step[];
}
```
Replace the 3 hand-written `<article>` blocks with `{steps.map((step) => (<article>...</article>))}`.

### 4.1.4 — `blocks/Review.astro` (homepage, Swiper carousel)

```ts
interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar: string;
}
interface Props {
  heading: string;
  testimonials: Testimonial[];
}
```
Loop `testimonials.map(...)` inside `.swiper-wrapper`; the `<script>` Swiper init block is
unchanged (it just needs at least one `.swiper-slide` to exist at runtime, which the loop still
produces).

### 4.1.5 — `blocks/FAQ.astro` (homepage)

```ts
interface FaqItem { question: string; answer: string; }
interface Props {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  faqs: FaqItem[];
}
```
Delete the hardcoded `const faqs = [...]` and destructure `faqs` from `Astro.props` instead — the
`faqSchema` JSON-LD block below it already maps over `faqs`, so it keeps working unchanged once
`faqs` comes from props.

### 4.1.6 — `blocks/CTA.astro` (reused: Home, Pricing, Contact)

```ts
interface Props {
  logo?: string;         // "/img/logo-icon.svg" today — optional, falls back if omitted
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
}
```
Because this is the **same component instance imported three times today**, once it's a block you
add it to the `blocks[]` array on Home, Pricing, *and* Contact pages independently — each with its
own field values (or the same copy, editor's choice). This is exactly the "same block, multiple
pages/instances" pattern Thunder's page builder supports natively.

### 4.1.7 — `blocks/ContactHero.astro` (renamed from `contactpage/Hero.astro`)

```ts
interface ContactMethod {
  icon: string;   // sprite id today ("contact-phone" etc.) — keep as string, not image
  label: string;  // "Give us a call"
  value: string;  // "+44 45 7200 8200"
  href: string;   // "tel:+444572008200"
}
interface Props {
  heading: string;
  subheading: string;
  methods: ContactMethod[];
}
```
The embedded `<Form />` (→ move to `src/components/forms/FormContact.astro`, see §5) stays a
plain import, not a prop — forms aren't CMS content.

### 4.1.8 — `blocks/ContactReview.astro` (renamed from `contactpage/Review.astro`)

Same `Testimonial`/`Props` shape as 4.1.4 (no Swiper here, just a static 4-card grid) — you can
literally share the `Testimonial` type between the two files.

### 4.1.9 — `blocks/Plan.astro` (pricing) — medium refactor

```ts
interface PricingPlan {
  name: string;               // "Starter Plan"
  priceMonthly: string;       // "₹ 10 INR"
  priceYearly: string;        // "₹ 110 INR"
  description: string;
  featured: boolean;          // true → the highlighted "Pro Plan" styling
  features: string[];         // tags — bullet list
  ctaLabel: string;
  ctaHref: string;
}
interface Props {
  heading: string;
  subheading: string;
  discountNote: string;       // "Get 50% off on yearly plan 🤩"
  plans: PricingPlan[];
}
```
This is the one real template rewrite: today the monthly/yearly tab content is two separately
hand-written blocks of markup. Replace both with one `{plans.map((plan) => (<article class:list={[..., plan.featured && "bg-custom-blue-300 text-white"]}>...</article>))}`, rendered once for
`priceMonthly` (monthly tab) and once for `priceYearly` (yearly tab) — same `plans` array, two
render passes, tab-toggle JS unchanged.

### 4.1.10 — `blocks/Brands.astro` (pricing)

```ts
interface Props {
  intro: string;               // "Trusted by 500+ Companies"
  brands: { src: string }[];
}
```

### 4.1.11 — `blocks/BannerCTA.astro` (blog)

```ts
interface Props {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  backgroundImage: string;    // move off the Tailwind arbitrary-value class into style={`background-image:url(${backgroundImage})`}
}
```

### 4.1.12 — `blocks/Subscribe.astro` (blog)

```ts
interface Props {
  heading: string;
  body: string;
}
```
Keep the `<form>` markup, `action`, and field names unchanged — only heading/body become props.

---

## 5. Folder restructure (fixes collisions + excludes chrome from scanning)

Two problems solved by one move:

1. **Name collisions** — `discover.ts` keys a block by filename only, not folder. Right now
   `homepage/Hero.astro` and `contactpage/Hero.astro` would both discover as key `hero` (same for
   `Review.astro`) and silently overwrite each other in the registry and in the generated
   renderer's `BLOCK_COMPONENTS` map.
2. **Chrome pollution** — `isComponentFile()` in `discover.ts` treats **every** `.astro` file as a
   candidate block, with no folder exclusion. Left in `src/components/`, `Header.astro`,
   `Footer.astro`, `Navbar.astro`, etc. would all register as zero-field "blocks" and clutter the
   palette.

**Fix: give Thunder its own scoped folder.** Move only the true page-section components into it;
leave chrome, forms, and content-cards where they are (or regroup them, your choice — they just
must stay *outside* `componentsRoot`).

```
src/components/
├── blocks/                        ← set as Thunder's componentsRoot (Project Settings)
│   ├── Hero.astro                   (was homepage/Hero.astro)
│   ├── Features.astro
│   ├── HowWorks.astro
│   ├── Review.astro
│   ├── FAQ.astro
│   ├── CTA.astro
│   ├── ContactHero.astro            (was contactpage/Hero.astro — renamed)
│   ├── ContactReview.astro          (was contactpage/Review.astro — renamed)
│   ├── Plan.astro
│   ├── Brands.astro
│   ├── BannerCTA.astro
│   └── Subscribe.astro
├── content-cards/                  ← NOT scanned, driven by getCollection()
│   ├── BlogCard.astro
│   ├── BlogVideoPosts.astro
│   └── VideoPostCard.astro
├── forms/
│   ├── LoginForm.astro
│   ├── RegisterForm.astro
│   └── FormContact.astro           (moved from contactpage/)
├── static/
│   └── Table.astro                 (moved from pricingpage/ — kept code-only, see §4.2)
├── Header.astro                    ← unchanged, site chrome
├── Footer.astro
├── Navbar.astro
├── Drawer.astro
├── Logo.astro
├── SVG.astro
├── SEO.astro
├── FormattedDate.astro
└── HeaderLink.astro
```

After the move, update every `import ... from "../components/homepage/Hero.astro"` (etc.) across
`src/pages/*.astro` to the new paths. Because block source components inside `blocks/` now sit in
one flat folder, Thunder's category-from-subfolder grouping
(`categoryFromComponentPath` in `apps/web/src/lib/blocks/effective.ts`) will bucket all 12 under a
single "Components" category in the palette — fine for a site this size. If you want separate
palette groups (Marketing / Contact / Pricing / Blog), nest one level deeper instead:
`blocks/marketing/Hero.astro`, `blocks/contact/ContactHero.astro`, `blocks/pricing/Plan.astro`,
`blocks/blog/BannerCTA.astro` — categories become "Marketing", "Contact", "Pricing", "Blog"
automatically, no config needed either way.

---

## 6. Content collections — already Thunder-ready

No code changes needed here. Once connected with `contentRoot = src/content`, Thunder's frontmatter
inference (`apps/web/src/lib/content/schema.ts`) reads these fields straight off existing entries:

| Collection | Fields (inferred from real files) | Notes |
|---|---|---|
| `blog` | `title` (string), `description` (text), `pubDate` (date), `heroImage` (image), `category` (string) + Markdown body | Do the cleanup in §3 first (dupes + image location) |
| `video-library` | `title`, `description`, `pubDate`, `heroImage` (image), `watch` (number) + Markdown body | Same image-location note applies |

Thunder does **not** read an Astro `content.config.ts` schema (this repo doesn't have one anyway —
both collections work today via Astro's implicit folder-based collections). It infers types purely
from the actual frontmatter values present across files in the folder, so **keep frontmatter keys
consistent across every file in a collection** — an entry missing a key, or using a different key
name, degrades the inferred schema for the whole collection.

---

## 7. Connect the repo in Thunder CMS

Prerequisite: push the §3–§5 changes to `AdnanEnacton/thunder-test` first (the repo is already on
GitHub, branch `master`, clean).

1. Sign in to Thunder CMS (running locally per your other setup, or wherever you deploy it) →
   **New Project** → GitHub → authorize the GitHub OAuth app if not already → pick
   **AdnanEnacton/thunder-test**.
2. Thunder scans the repo tree and auto-detects **Astro** (`astro.config.mjs` present).
3. Setup wizard — use these exact values for this repo (override the framework's generic Astro
   defaults where noted):

   | Wizard step | Field | Value | Why |
   |---|---|---|---|
   | Content folder | Content root | `src/content` | matches the Astro default, correct as-is |
   | Media settings | Media root | **`public/img`** | ⚠️ override — Astro default guess is `public/images`, this repo uses `public/img` |
   | Media settings | Media public path | `public` | correct as-is |
   | Optional paths | Code root | `src/layouts` | Astro default, harmless either way (unrelated to blocks) |
   | Optional paths | Config paths | leave blank, or add `astro.config.mjs` | only add if you want site/integration config editable from Thunder's Config Files tab |
   | Review | — | confirm and finish | commits `.thunder/config.json` to the repo |

4. **Separately**, in **Project Settings** (not the wizard — a different field,
   `apps/web/src/components/project/project-settings-client.tsx`), set:

   | Field | Value |
   |---|---|
   | Components folder | **`src/components/blocks`** |

---

## 8. Discover the blocks

1. In the project dashboard, open the block registry / **"Scan components"** action
   (`lib/blocks/discover.ts` via the scan API). Thunder reads every `.astro` file under
   `src/components/blocks/` and proposes 12 blocks with fields matching §4.
2. Review screen: confirm labels, tweak categories/icons if desired, accept into the registry.
   Nothing here is silently authoritative — you review every proposed block before it's saved.
3. Re-scan any time you add a new prop to a block component or add a new component to
   `blocks/` — Thunder re-reads the file and updates the field list.

---

## 9. Turn Home / Pricing / Contact into Component Pages — driven by one `[...slug].astro`

Today these are three static `.astro` pages with hardcoded imports. Instead of writing a separate
page file per route, use the **same catch-all pattern this repo already uses for blog posts**
(`src/pages/blog/[...slug].astro` → `getStaticPaths()` + `getCollection('blog')`). Every page
becomes a Markdown file in `src/content/pages/`, and **one** `src/pages/[...slug].astro` renders
all of them generically. This is the scalable version: a content editor creating a brand-new page
in Thunder (say, "About") needs **zero code changes** — it's just a new file in the collection and
the catch-all serves it automatically.

### 9.1 Create the `pages` collection

`src/content/pages/home.md`, `pricing.md`, `contact.md` — file name = route slug, with one
exception: `home.md` maps to `/` (root), handled in `getStaticPaths()` below, not by its filename.

```yaml
---
title: Home
type: component
blocks:
  - _template: hero
    heading: Early pay, Automatic savings, Transform your money habits
    subheading: Support small businesses with simple invoicing, powerful integrations, and cash flow management tools.
    primaryCtaLabel: Get started
    primaryCtaHref: /signup
    secondaryCtaLabel: Learn more
    secondaryCtaHref: "#"
    trustedCount: "500+"
    heroImage: /img/home/img1.webp
    brands:
      - src: /img/brands/b1.png
      - src: /img/brands/b2.png
      - src: /img/brands/b3.png
      - src: /img/brands/b4.png
  - _template: features
    sectionHeading: Experience the convenience of making multiple payments with one app.
    # ...remaining Features fields from §4.1.2
  - _template: howWorks
    # ...
  - _template: review
    # ...
  - _template: faq
    # ...
  - _template: cta
    # ...
---
```
Same shape for `pricing.md` (`plan`, `brands`, `review`, `cta` blocks — `table` stays code-only per
§4.2, rendered as a fixed `<Table />` import in the catch-all below, not from `blocks[]`) and
`contact.md` (`contactHero`, `contactReview`, `cta` blocks). This is just your current hardcoded
copy pasted into frontmatter once — after that you edit it visually in Thunder.

### 9.2 One dynamic route replaces `index.astro` / `pricing.astro` / `contact.astro`

Delete those three files and add `src/pages/[...slug].astro`:

```astro
---
import Layout from "../layouts/Main.astro";
import Blocks from "../components/blocks/Blocks.astro"; // generated in §10
import Table from "../components/static/Table.astro";   // still code-only, see §4.2
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const pages = await getCollection("pages");
  return pages.map((page) => ({
    params: { slug: page.id === "home" ? undefined : page.id },
    props: page,
  }));
}

const page = Astro.props;
---
<Layout>
  <Blocks blocks={page.data.blocks} />
  {page.id === "pricing" && <Table />}
</Layout>
```
`params: { slug: undefined }` is Astro's documented way to make a rest-parameter route (`[...slug]`)
also match the bare `/` path — that's how `home.md` becomes the homepage without a special case in
the file layout. `pricing.md` → `/pricing`, `contact.md` → `/contact`, and any future page an
editor creates (e.g. `about.md`) → `/about`, automatically, with no new route file.

This coexists safely with your other static routes (`login.astro`, `signup.astro`, `404.astro`,
`500.astro`, `blog/**`) — Astro always prefers a static/exact-match route over a `[...slug]`
catch-all, so `/login` etc. are untouched.

### 9.3 Verify

Run `npm run dev` / `npm run build` after adding the first page file. Astro's implicit
content-collection support (no `content.config.ts`) already works for `blog`/`video-library` in
this repo, so `pages/` should work the same way with zero extra config. If Astro ever complains
about an unrecognized collection, add a minimal `src/content.config.ts`:
```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({ title: z.string(), type: z.literal("component"), blocks: z.array(z.record(z.unknown())) }),
});
export const collections = { pages };
```

---

## 10. Generate the `Blocks.astro` renderer

Thunder can generate and commit this for you (`lib/blocks/render-gen.ts` →
"Add `<Blocks>` to repo" action, framework auto-detected as `astro`). It writes
`src/components/blocks/Blocks.astro` in **glob mode** by default:

```astro
---
const modules = import.meta.glob("/src/components/blocks/**/*.astro", { eager: true });
function keyFor(path) {
  let name = path.split("/").pop().replace(/\.astro$/, "");
  return name.charAt(0).toLowerCase() + name.slice(1);
}
const BLOCK_COMPONENTS = {};
for (const [path, mod] of Object.entries(modules)) {
  if (path.endsWith("/Blocks.astro")) continue;
  BLOCK_COMPONENTS[keyFor(path)] = mod.default;
}
const { blocks = [] } = Astro.props;
---
{blocks.map((block) => {
  const Component = BLOCK_COMPONENTS[block._template];
  return Component ? <Component {...block} /> : null;
})}
```

This is why the §5 rename (`ContactHero`, `ContactReview`) matters here too — glob mode keys
**purely by filename**, so without the rename this generated file would have the exact same
collision as the discovery scan.

Because it's glob-based, adding a **new** block component later (e.g. `blocks/Testimonial2.astro`
with a `Props` interface) needs **no re-wiring** — it's auto-imported and immediately usable in
the page builder after a re-scan.

---

## 11. Day-to-day editing workflow (once connected)

- **Content editors** get invited via Team → Invite (SMTP email if configured, else copy-link) —
  RBAC is Owner vs Editor, enforced on every route.
- **Blog/video posts**: edit directly — title/description/date/image/category form fields +
  Notion-style body editor, save → commits to `src/content/blog/*.md`.
- **Home/Pricing/Contact**: open in the page builder — palette (left) shows your 12 blocks
  grouped by category, canvas (middle) shows the current stack with move-up/down/duplicate/delete,
  field panel (right) edits the selected block's props live. Save → commits to
  `src/content/pages/*.md`.
- **Media**: upload/browse/delete under `public/img/`, copy public path, use the picker directly
  in image fields.
- **New pages**: because routing goes through the `[...slug].astro` catch-all (§9.2), creating a
  brand-new page in Thunder (e.g. "About") just adds `src/content/pages/about.md` — it's live at
  `/about` on the next deploy with no developer involvement, no new route file.
- Every save/upload/configure is written to the activity log (audit trail).
- On a save conflict (someone else edited the same file), Thunder offers reload-latest /
  overwrite / keep-editing — no silent data loss.

---

## 12. Deployment (optional, not required to start editing)

Thunder intentionally does **not** create PRs or run your build — per its own docs, promotion is
meant to be handled by your own GitHub Actions on an `editor` branch
(`editor → staging → main`), triggered by a `src/config/deploy.json` bump. You don't need this to
start using Thunder — commits land straight on `master` (your current default branch) and your
existing deploy (Vercel, per `astro.config.mjs`'s `site` field) picks them up normally. Only set up
the editor/staging/main branch flow later if you want a review step before changes go live.

---

## 13. Execution checklist

- [x] §3 — delete `*copy.md` duplicates, decide on hero-image location. **Done**: duplicates
      removed, hero images moved to `public/img/blog/` and `public/img/video-library/`,
      frontmatter updated. Also updated `src/content.config.ts` (which the plan didn't know
      existed) from `image()` to plain `z.string()` for `heroImage`, since `image()` can't
      resolve `public/` paths.
- [x] §4 — add `Props` interfaces to the 12 target components, wire `Astro.props` in each
      template. **Done**, including two small pre-existing bug fixes surfaced by the refactor
      (a mismatched avatar `width`/`height` in `Review.astro`, a stray literal newline breaking
      `method="POST"` in `Subscribe.astro`).
- [x] §5 — move files into `src/components/blocks/`, `content-cards/`, `forms/`, `static/`;
      rename `ContactHero.astro` / `ContactReview.astro`; fix all `import` paths in
      `src/pages/*.astro`. **Done.**
- [x] §9 — create `src/content/pages/{home,pricing,contact}.md`; delete `index.astro`,
      `pricing.astro`, `contact.astro`; add one `src/pages/[...slug].astro` catch-all
      (`getStaticPaths()` + `getCollection('pages')`, same pattern as `blog/[...slug].astro`);
      verify `npm run build` still passes. **Done** — also registered the `pages` collection in
      `content.config.ts` (not mentioned in the plan's §9.3 fallback, needed regardless).
- [x] Commit and push all of the above to `AdnanEnacton/thunder-test`. **Done** — commit `36ad3d3`
      on `master`, pushed. Verified live via `astro preview` + `curl` against every route (home,
      pricing, contact, blog list, blog post, 404 on unknown paths). One pre-existing, out-of-scope
      gap noted: `/video-library/*` routes are linked from `VideoPostCard.astro` but no page file
      for them has ever existed in this repo.
- [ ] §7 — connect the repo in Thunder CMS, run the setup wizard with the exact values listed,
      set Components folder in Project Settings. **Not done — requires a running Thunder CMS
      instance and interactive GitHub OAuth authorization; this is a manual step only you can
      perform.**
- [ ] §8 — scan components, review, accept into the registry. **Not done — same reason as §7,
      depends on being connected first.**
- [x] §10 — generate and commit `Blocks.astro`. **Done** — also corrected the `keyFor` key
      derivation to a proper camelCase mapper (the plan's own §9.1 example `_template: cta` and
      §10's literal `keyFor` snippet disagreed — the naive version would have produced `cTA`/`fAQ`
      for `CTA.astro`/`FAQ.astro`).
- [ ] Open Home/Pricing/Contact in the page builder, confirm every block's fields match its live
      component, do a trial edit + save, confirm the commit landed in GitHub and the site still
      renders correctly on your next deploy. **Not done — depends on §7/§8 being completed in the
      Thunder UI first.**
