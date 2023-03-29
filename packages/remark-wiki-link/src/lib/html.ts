import { isSupportedFileFormat } from "./isSupportedFileFormat";

export interface HtmlOptions {
  pathFormat?:
    | "raw" // default; use for regular relative or absolute paths
    | "obsidian-absolute" // use for Obsidian-style absolute paths, i.e. with no leading slash
    | "obsidian-short"; // use for Obsidian-style shortened paths
  permalinks?: string[];
  pageResolver?: (name: string) => string[];
  newClassName?: string;
  wikiLinkClassName?: string;
  hrefTemplate?: (permalink: string) => string;
}

// Micromark HtmlExtension
// https://github.com/micromark/micromark#htmlextension
function html(opts: HtmlOptions = {}) {
  const pathFormat = opts.pathFormat || "raw";
  const permalinks = opts.permalinks || [];
  const defaultPageResolver = (name: string, isEmbed: boolean) => {
    let page = isEmbed
      ? name
      : name
          .replace(/ /g, "-")
          .replace(/\/index$/, "")
          .toLowerCase();
    if (pathFormat === "obsidian-absolute") {
      page = `/${page}`;
    }
    if (page.length === 0) {
      page = "/";
    }
    return [page];
  };
  const pageResolver = opts.pageResolver || defaultPageResolver;
  const newClassName = opts.newClassName || "new";
  const wikiLinkClassName = opts.wikiLinkClassName || "internal";
  const defaultHrefTemplate = (permalink: string) => permalink;
  const hrefTemplate = opts.hrefTemplate || defaultHrefTemplate;

  function top(stack) {
    return stack[stack.length - 1];
  }

  function enterWikiLink() {
    let stack = this.getData("wikiLinkStack");
    if (!stack) this.setData("wikiLinkStack", (stack = []));

    stack.push({});
  }

  function exitWikiLinkTarget(token) {
    const target = this.sliceSerialize(token);
    const current = top(this.getData("wikiLinkStack"));
    current.target = target;
  }

  function exitWikiLinkAlias(token) {
    const alias = this.sliceSerialize(token);
    const current = top(this.getData("wikiLinkStack"));
    current.alias = alias;
  }

  function exitWikiLink(token) {
    const wikiLink = this.getData("wikiLinkStack").pop();
    const { target, alias } = wikiLink;
    const isEmbed = token.isType === "embed";

    const resolveShortenedPaths = pathFormat === "obsidian-short";
    const pagePermalinks = pageResolver(target, isEmbed);

    // eslint-disable-next-line no-useless-escape
    const pathWithOptionalHeadingPattern = /([a-z0-9\.\/_-]*)(#.*)?/;
    let targetHeading = "";

    const matchingPermalink = permalinks.find((e) => {
      return pagePermalinks.find((p) => {
        const [, pagePath, heading] = p.match(pathWithOptionalHeadingPattern);
        const permalink = pagePath || "/";
        if (resolveShortenedPaths) {
          if (e === permalink || e.endsWith(permalink)) {
            targetHeading = heading ?? "";
            return true;
          }
          return false;
        } else {
          if (e === permalink) {
            targetHeading = heading ?? "";
            return true;
          }
          return false;
        }
      });
    });

    const permalink = matchingPermalink || pagePermalinks[0];

    // remove leading # if the target is a heading on the same page
    const displayName = alias || target.replace(/^#/, "");

    let classNames = wikiLinkClassName;
    if (!matchingPermalink) {
      classNames += " " + newClassName;
    }

    if (isEmbed) {
      const [isSupportedFormat, format] = isSupportedFileFormat(target);
      if (!isSupportedFormat) {
        this.raw(`![[${target}]]`);
      } else if (format === "pdf") {
        this.tag(
          `<iframe width="100%" src="${hrefTemplate(
            permalink
          )}#toolbar=0" class="${classNames}" />`
        );
      } else {
        this.tag(
          `<img src="${hrefTemplate(
            permalink
          )}" alt="${displayName}" class="${classNames}" />`
        );
      }
    } else {
      this.tag(
        `<a href="${hrefTemplate(
          permalink + targetHeading
        )}" class="${classNames}">`
      );
      this.raw(displayName);
      this.tag("</a>");
    }
  }

  return {
    enter: {
      wikiLink: enterWikiLink,
    },
    exit: {
      wikiLinkTarget: exitWikiLinkTarget,
      wikiLinkAlias: exitWikiLinkAlias,
      wikiLink: exitWikiLink,
    },
  };
}

export { html };