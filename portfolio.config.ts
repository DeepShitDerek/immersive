// =============================================================================
// FOLIOKIT - Portfolio Configuration
//
// This is the template's sample person, John Doe: a made-up full-stack
// engineer with made-up employers, projects and numbers. Nobody here is real.
// Replace every value with your own. In static mode (no database) this file
// is the whole site; with a database it is the fallback, and
// db/john-doe.sample.sql loads the same person into Supabase.
// =============================================================================

const portfolioConfig = {
  // ---------------------------------------------------------------------------
  // IDENTITY
  // ---------------------------------------------------------------------------
  name: "John Doe",
  title: "Full-Stack Engineer",
  description:
    "Web products from first sketch to production: clear interfaces, dependable APIs, and the unglamorous work that keeps both fast.",

  // The one line a visitor should leave with: the home page's main heading,
  // with your name as the byline under it. Leave empty to lead with your name.
  headline: "I build web products that stay fast after the launch party.",

  // Results you can stand behind, shown as a strip under the hero (up to 4).
  // A figure a client can check beats any adjective.
  proof: [
    { value: "40%", label: "faster checkout after the Northwind rebuild" },
    { value: "7 yrs", label: "shipping production web software" },
    { value: "12", label: "products launched, from MVP to scale" },
    { value: "99.95%", label: "uptime on the last platform I ran" },
  ],
  // GitHub's own demo account, so the picture is nobody's face. Use your own.
  profilePicture: "https://github.com/octocat.png",
  showProfilePicture: true,

  logo: {
    main: "john",
    highlight: ".dev",
  },

  bio: [
    "I'm a full-stack engineer with seven years of turning ideas into products people use every day. At Northwind Labs I led the rebuild of a checkout that had grown slow and fragile; the new one is 40% faster and has not paged anyone at night since.",
    "I started on the front end, moved to APIs because I wanted to fix the slow parts myself, and now work across both. I care about boring things done well: schemas that make bad states impossible, interfaces that work with a keyboard, and deploys nobody has to watch.",
  ],

  // ---------------------------------------------------------------------------
  // THEME
  // ---------------------------------------------------------------------------
  defaultTheme: "theme-field-notes-light",
  typographyPreset: "typo-modern-editorial",
  portfolioMode: "multi-page" as const,

  // ---------------------------------------------------------------------------
  // STATUS PANEL
  // ---------------------------------------------------------------------------
  statusPanel: {
    show: true,
    design: "minimal" as const,
    title: "Current Status",
    availability: "Open to senior full-stack roles and select contracts",
    currentlyExploring: {
      title: "Learning",
      items: ["Rust", "Local-first sync", "Postgres internals"],
    },
    latestProject: {
      name: "Taskflow — a keyboard-first task manager",
      linkText: "See the work",
      href: "/work",
    },
  },

  // ---------------------------------------------------------------------------
  // SOCIAL LINKS
  // ---------------------------------------------------------------------------
  // example.com addresses are placeholders that go nowhere. Use your own.
  socialLinks: [
    {
      id: "email",
      label: "Email",
      url: "mailto:john@example.com",
    },
    {
      id: "github",
      label: "GitHub",
      url: "https://github.com/octocat",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      url: "https://example.com/linkedin/john-doe",
    },
  ],

  // ---------------------------------------------------------------------------
  // FOOTER
  // ---------------------------------------------------------------------------
  footerText: "Built with Next.js & Supabase · Anytown",

  // ---------------------------------------------------------------------------
  // GITHUB PROJECTS
  // ---------------------------------------------------------------------------
  // "octocat" is GitHub's demo account; its public repositories stand in
  // until you put your own username here. Set `show: false` to hide the list.
  github: {
    username: "octocat",
    show: true,
    sortBy: "pushed" as const,
    excludeForks: true,
    excludeArchived: true,
    excludeProfileRepo: true,
    minStars: 0,
    projectsPerPage: 6,
  },

  // ---------------------------------------------------------------------------
  // CONTACT PAGE
  // ---------------------------------------------------------------------------
  contact: {
    showContactForm: true,
    showAvailabilityBadge: true,
    showServices: true,
  },

  // ---------------------------------------------------------------------------
  // NAVIGATION
  // ---------------------------------------------------------------------------
  // Work-led: four destinations, and the /contact link renders as the
  // header's call to action. The logo is the way home.
  navLinks: [
    { label: "Work", href: "/work" },
    { label: "About", href: "/about" },
    { label: "Writing", href: "/blog" },
    { label: "Work with me", href: "/contact" },
  ],

  // Pages that live in the footer only. (The Foliokit credit is separate —
  // see `product.show`.)
  footerLinks: [{ label: "Updates", href: "/updates" }],

  // ---------------------------------------------------------------------------
  // EXPERIENCE
  // ---------------------------------------------------------------------------
  experience: [
    {
      title: "Senior Full-Stack Engineer",
      company: "Northwind Labs",
      from: "Mar 2022",
      to: "Present",
      description:
        "Led the rebuild of the checkout and order pipeline for a marketplace handling 30,000 orders a day. Cut median checkout time by 40%, moved the team to trunk-based releases, and wrote the runbooks the on-call rota still uses.",
      tags: ["TypeScript", "Next.js", "PostgreSQL", "Node.js", "AWS"],
    },
    {
      title: "Full-Stack Engineer",
      company: "Acme Analytics",
      from: "Jun 2019",
      to: "Feb 2022",
      description:
        "Built the dashboard builder customers use to explore their own data: a drag-and-drop editor on the front, a query planner behind it. Took report load times from eight seconds to under one.",
      tags: ["React", "Python", "FastAPI", "ClickHouse"],
    },
    {
      title: "Front-End Developer",
      company: "Contoso Studio",
      from: "Aug 2017",
      to: "May 2019",
      description:
        "Shipped marketing sites and web apps for a dozen clients. Introduced the studio's first component library and its accessibility checklist.",
      tags: ["JavaScript", "Vue", "Sass", "Accessibility"],
    },
  ],

  // ---------------------------------------------------------------------------
  // TECH STACK
  // ---------------------------------------------------------------------------
  techStack: [
    {
      title: "TypeScript / React / Next.js",
      description: "Product front ends, from design system to deploy",
    },
    {
      title: "Node.js & Python",
      description: "APIs, background jobs and the glue between systems",
    },
    {
      title: "PostgreSQL",
      description: "Schema design, query tuning, row-level security",
    },
    {
      title: "AWS & Docker",
      description: "Containers, queues and infrastructure as code",
    },
    {
      title: "Testing",
      description: "Unit, integration and browser tests that earn their keep",
    },
    {
      title: "Accessibility",
      description: "WCAG 2.2 AA as a build requirement, not a retrofit",
    },
  ],

  // ---------------------------------------------------------------------------
  // TOOLS
  // ---------------------------------------------------------------------------
  tools: [
    { title: "Figma", description: "Reading designs and prototyping changes." },
    {
      title: "Playwright",
      description: "Browser tests for the flows that must not break.",
    },
    { title: "Grafana", description: "Dashboards and alerts for what ships." },
    {
      title: "GitHub Actions",
      description: "Build, test and deploy on every push.",
    },
  ],

  // ---------------------------------------------------------------------------
  // EDUCATION
  // ---------------------------------------------------------------------------
  education: [
    {
      title: "BSc, Computer Science",
      institution: "Example State University",
      from: "Sep 2013",
      to: "Jun 2017",
      description:
        "First-class honours. Final-year project on offline-first web applications.",
    },
    {
      title: "Certificate, Web Accessibility",
      institution: "Example Institute of Technology",
      from: "Jan 2020",
      to: "Apr 2020",
      description: "WCAG auditing, assistive technology and inclusive design.",
    },
  ],

  // ---------------------------------------------------------------------------
  // SHOWCASE
  // ---------------------------------------------------------------------------
  showcase: [
    {
      title: "Northwind checkout rebuild",
      description:
        "A checkout that had grown slow and fragile, rebuilt in place without a day of downtime. Median time to pay fell by 40% and abandoned carts by a fifth.",
      link: "https://example.com/northwind",
      tags: ["Next.js", "PostgreSQL", "Payments", "Performance"],
    },
    {
      title: "Acme dashboard builder",
      description:
        "A drag-and-drop report editor over a query planner that keeps large reports interactive. Report load time went from eight seconds to under one.",
      link: "https://example.com/acme",
      tags: ["React", "FastAPI", "ClickHouse", "Data"],
    },
  ],

  // ---------------------------------------------------------------------------
  // FEATURED PROJECTS
  // ---------------------------------------------------------------------------
  projects: [
    {
      title: "Taskflow",
      subtitle: "A keyboard-first task manager",
      description:
        "Tasks, projects and a daily plan you can drive without touching the mouse. Works offline and syncs when it can.\n\n[View the source](https://example.com/taskflow)",
      tags: ["TypeScript", "Local-first", "PWA"],
      link: "https://example.com/taskflow",
      image: "",
    },
    {
      title: "Pingboard",
      subtitle: "Uptime checks you can read at a glance",
      description:
        "A small self-hosted monitor: checks every minute, one status page, alerts that say what broke.\n\n[View the source](https://example.com/pingboard)",
      tags: ["Go", "SQLite", "Monitoring"],
      link: "https://example.com/pingboard",
      image: "",
    },
    {
      title: "Markleaf",
      subtitle: "Markdown notes that stay plain files",
      description:
        "A notes app that never locks your writing in: plain Markdown on disk, fast search on top.\n\n[View the source](https://example.com/markleaf)",
      tags: ["Rust", "Tauri", "Search"],
      link: "https://example.com/markleaf",
      image: "",
    },
  ],

  // ---------------------------------------------------------------------------
  // SERVICES
  // ---------------------------------------------------------------------------
  services: [
    {
      title: "Product engineering",
      subtitle: "React · Next.js · Node.js",
      description:
        "A feature or a whole product, taken from a rough brief to something your customers use: front end, API, database and deploy.",
      tags: ["Web apps", "APIs", "Auth", "Deployment"],
    },
    {
      title: "Performance & reliability",
      subtitle: "Profiling · Caching · Observability",
      description:
        "Finding why it is slow or flaky, fixing the cause, and leaving the dashboards and alerts that keep it fixed.",
      tags: ["Core Web Vitals", "Query tuning", "On-call"],
    },
    {
      title: "Accessibility audits",
      subtitle: "WCAG 2.2 AA",
      description:
        "A review of your product against WCAG with a prioritised list of fixes, and help making them.",
      tags: ["Audits", "Keyboard", "Screen readers"],
    },
  ],

  // ---------------------------------------------------------------------------
  // PROCESS — "How I work" on the home page
  // ---------------------------------------------------------------------------
  process: [
    {
      title: "Discovery call",
      duration: "30 minutes",
      description:
        "What you're trying to change, what you have today, and whether I'm the right person for it.",
    },
    {
      title: "Scoped proposal",
      duration: "A few days",
      description:
        "A written plan: the smallest version worth shipping, what it takes, and how we'll know it worked.",
    },
    {
      title: "Build in the open",
      duration: "Weekly demos",
      description:
        "Working software every week against your real data, so you can steer while changes are still cheap.",
    },
    {
      title: "Ship and hand over",
      duration: "Launch",
      description:
        "Deployed, monitored and documented — with your team able to run it without me.",
    },
  ],

  // ---------------------------------------------------------------------------
  // BLOG POSTS
  // ---------------------------------------------------------------------------
  // Add `draft: true` to a post to keep it off the site until it is ready.
  blogPosts: [
    {
      title: "What a 40% faster checkout actually took",
      slug: "what-a-faster-checkout-took",
      excerpt:
        "No rewrite, no new framework. Three boring changes did almost all of it, and the fourth we tried made things worse.",
      content:
        "## Where the time went\n\nBefore touching anything we measured. Most of the wait was not rendering or the network: it was four database round trips that could have been one.\n\n## The three changes\n\n- One query for the cart instead of four\n- Prices computed once, on the server\n- The payment form loaded before the customer asks for it\n\n## The change that made it worse\n\nWe added a cache in front of stock levels. It was fast, and it was wrong often enough to oversell. We took it out.\n\n## What I'd do again\n\nMeasure first, change one thing at a time, and keep the dashboard open while you do.",
      tags: ["Performance", "PostgreSQL", "Checkout"],
      showToc: true,
    },
    {
      title: "Schemas that make bad states impossible",
      slug: "schemas-that-make-bad-states-impossible",
      excerpt:
        "Every validation you write in application code is one a second service will forget. Put the rule where the data lives.",
      content:
        "## The bug that started it\n\nAn order with a negative quantity reached the warehouse. Three services had a check for it; a fourth, written later, did not.\n\n## Constraints are documentation that runs\n\nA `CHECK (quantity > 0)` cannot be forgotten by the next service.\n\n```sql\nALTER TABLE order_lines\n  ADD CONSTRAINT quantity_positive CHECK (quantity > 0);\n```\n\n## When not to\n\nRules that change every quarter belong in code. Rules that are true by definition belong in the schema.",
      tags: ["PostgreSQL", "Data modelling"],
      showToc: true,
    },
    {
      title: "A keyboard is the best accessibility test you own",
      slug: "keyboard-accessibility-test",
      excerpt:
        "Unplug the mouse for ten minutes. Most of what an audit would find, you will find first.",
      content:
        "## Ten minutes, no mouse\n\nTab through your own product. Can you see where you are? Can you reach everything? Can you get out of the dialog you opened?\n\n## What it catches\n\n- Focus that disappears\n- Controls that are only clickable\n- Menus that trap you\n\n## What it does not\n\nContrast, alternative text and reading order still need their own checks.",
      tags: ["Accessibility", "Testing"],
      showToc: false,
    },
  ],

  // ---------------------------------------------------------------------------
  // LIFE UPDATES
  // ---------------------------------------------------------------------------
  updatesLayout: "scrapbook" as const,

  lifeUpdates: [
    {
      title: "The Northwind checkout is live",
      content:
        "Eight months of work, switched over on a Tuesday afternoon with nobody watching a dashboard in fear. 40% faster, and quieter.",
      category: "milestone" as const,
      tags: ["Launch", "Performance"],
      isPinned: true,
    },
    {
      title: "Learning Rust by rewriting Markleaf's search",
      content:
        "The borrow checker and I have reached an understanding. Search over ten thousand notes now answers before the key comes back up.",
      category: "activity" as const,
      tags: ["Rust", "Side project"],
      isPinned: false,
    },
    {
      title: "A note on estimates",
      content:
        "An estimate is a range, not a number. The honest ones come with what would make them wrong.",
      category: "thought" as const,
      tags: ["Engineering"],
      isPinned: false,
    },
  ],

  // ---------------------------------------------------------------------------
  // PRODUCT — the /kit page that sells Foliokit itself
  // ---------------------------------------------------------------------------
  // `show: false` removes /kit and the footer credit — what a site built *with*
  // Foliokit usually wants. Prices are yours to set; nothing here is invented.
  // `repoUrl` is Foliokit's own repository, not the sample person's.
  product: {
    show: true,
    name: "Foliokit",
    repoUrl: "https://github.com/akshay-bharadva/foliokit",
    plans: [
      {
        name: "Open source",
        price: "Free",
        period: "MIT licence",
        description:
          "Everything in the repository, to run on your own accounts.",
        features: [
          "Portfolio, blog and page builder",
          "The whole private workspace",
          "Every theme and type pairing",
          "Free static hosting",
        ],
        cta: {
          label: "Get it on GitHub",
          href: "https://github.com/akshay-bharadva/foliokit",
        },
        highlighted: false,
      },
      {
        name: "Done for you",
        price: "Let's talk",
        period: "one-off setup",
        description:
          "I set it up on your domain with your content, theme and Supabase, and walk you through it.",
        features: [
          "Deployed on your domain",
          "Your content moved in",
          "Supabase, storage and two-factor configured",
          "A walkthrough of the workspace",
        ],
        cta: { label: "Book a setup", href: "/contact" },
        highlighted: true,
      },
    ],
  },
};

export default portfolioConfig;
