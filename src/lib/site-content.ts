import portfolioConfig from "../../portfolio.config";

// Some content might remain static if not managed by the CMS
export const siteContent = {
  experience: {
    mainTitle: "Experience",
    mainSubtitle: "CAREER",
  },
  pages: {
    about: {
      title: "About Me",
      description: `Learn more about ${portfolioConfig.name}, the developer behind the code.`,
      heading: "[ ABOUT_ME ]",
      bio: [
        "I'm a full-stack developer specializing in building robust and scalable web applications. My passion lies at the intersection of clean architecture, efficient code, and intuitive user experiences.",
        "I thrive on solving complex problems and am constantly exploring new technologies to enhance my toolkit. I am a strong advocate for open-source and contribute to projects whenever I can.",
      ],
    },
    contact: {
      title: "Contact Me",
      description: `Let's build something great together. Get in touch with ${portfolioConfig.name}.`,
      heading: "Get in touch",
      subheading:
        "A role, a project, or something else entirely — tell me what you're working on.",
      servicesTitle: "What I Can Do For You",
    },
    work: {
      title: "Work",
      description: `Case studies, projects and open source by ${portfolioConfig.name}.`,
      heading: "Work",
      subheading:
        "Systems that shipped, what they changed, and the code behind them.",
    },
    blog: {
      title: "Writing",
      description:
        "A collection of articles on web development, design, and technology.",
    },
  },
  hero: {
    statusPanel: {
      latestProject: {
        title: "Latest Project",
        name: "Portfolio Redesign",
        linkText: "See all work",
        href: "/work",
      },
    },
  },
};
