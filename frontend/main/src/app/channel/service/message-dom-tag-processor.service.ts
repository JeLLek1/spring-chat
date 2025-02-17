import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import nodeTagTypeEnum, {
  NodeTagType,
} from '../enum/internal/node-tag-type.enum';

export class MessageNode {}

export class TextMessageNode extends MessageNode {
  constructor(public text: string) {
    super();
  }
}

export class TagMessageNode extends MessageNode {
  constructor(
    public tag: NodeTagType,
    public attr: Record<string, string>,
    public children: MessageNode[]
  ) {
    super();
  }
}

interface TagMatchGroups {
  startGroup: string;
  nameGroup: string;
  contentGroup: string;
  endGroup: string;
}

interface AttrMatchGroups {
  nameGroup: string;
  contentGroup: string;
}

@Injectable({
  providedIn: 'root',
})
export class MessageDomTagProcessorService {
  private readonly tagRegex =
    /(?<startGroup>\[\/?)\s*(?<nameGroup>[a-zA-Z0-9_-]+)\s*(?<contentGroup>.*?)(?<endGroup>\/?\])/g;
  private readonly tagAttributeRegex =
    /(?<nameGroup>[a-zA-Z0-9_-]+)\s*=\s*"(?<contentGroup>.*?)"/g;
  private readonly document = inject(DOCUMENT);

  public toTextNodes(input: string) {
    const root: TagMessageNode = new TagMessageNode(NodeTagType.LINE, {}, []);
    const stack: TagMessageNode[] = [];
    let last: TagMessageNode = root;
    let lastIndex = 0;

    const regex = new RegExp(this.tagRegex);

    const addTextNode = (matchIndex: number) => {
      const text = input.slice(lastIndex, matchIndex);
      last.children.push(new TextMessageNode(text));
    };

    let match = null;
    do {
      match = regex.exec(input);
      if (match === null) {
        break;
      }
      if (match.index > lastIndex) {
        addTextNode(match.index);
      }
      lastIndex = regex.lastIndex;

      const { startGroup, nameGroup, contentGroup, endGroup } =
        match.groups! as any as TagMatchGroups;
      const attr = this.parseTagAttr(contentGroup);
      const tagType = Object.values(NodeTagType).find(
        (el) => el === nameGroup
      ) as NodeTagType | undefined;
      if ((startGroup === '[/' && endGroup === '/]') || tagType === undefined) {
        continue;
      } else if (endGroup === '/]') {
        last.children.push(new TagMessageNode(tagType, attr, []));
      } else if (
        startGroup === '[/' &&
        stack.length > 0 &&
        last.tag === nameGroup
      ) {
        last = stack.pop()!;
      } else if (startGroup === '[' && endGroup === ']') {
        stack.push(last);
        const newTag = new TagMessageNode(tagType, attr, []);
        last.children.push(newTag);
        last = newTag;
      }
    } while (true);
    if (lastIndex < input.length) {
      addTextNode(input.length);
    }
    return root.children;
  }

  public toTags(element: HTMLElement | undefined): string {
    const tempElement = this.document.createElement('div');
    tempElement.innerHTML = element?.innerHTML ?? '';
    this.trimHTMLContent(tempElement, false);
    this.trimHTMLContent(tempElement, true);
    this.escapeTags(tempElement);
    this.replaceHtmlToTags(tempElement);
    this.replaceNbspToSpaces(tempElement);
    return tempElement.textContent ?? '';
  }

  private replaceNbspToSpaces(element: HTMLElement) {
    element.innerHTML = element.innerHTML.replace(/&nbsp;/g, ' ');
  }

  private trimHTMLContent(
    element: ChildNode,
    reverse = false,
    foundText = false
  ): boolean {
    let innerFoundText = foundText;
    const children = reverse
      ? Array.from(element.childNodes).reverse()
      : Array.from(element.childNodes);
    children.forEach((child) => {
      const resultFoundText = this.trimHTMLContent(
        child,
        reverse,
        innerFoundText
      );
      innerFoundText = innerFoundText || resultFoundText;
      const parent = child.parentNode!;

      if (!innerFoundText && child.textContent?.trim() === '') {
        parent.removeChild(child);
        return;
      }
      innerFoundText = true;
    });
    return innerFoundText;
  }

  private escapeTags(element: ChildNode) {
    Array.from(element.childNodes).forEach((child) => {
      if (child.hasChildNodes()) {
        this.escapeTags(child);
      } else {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = (child.textContent ?? '').replace(
            /\[|\]/g,
            (match) =>
              match === '['
                ? this.createTag(NodeTagType.SQUARE_BRACKET)
                : this.createTag(NodeTagType.SQUARE_BRACKET_END)
          );
        }
      }
    });
  }

  private replaceHtmlToTags = (element: ChildNode): void => {
    Array.from(element.childNodes).forEach((child) => {
      this.replaceHtmlToTags(child);
      const parent = child.parentNode!;
      let text = child.textContent ?? '';
      if (child instanceof HTMLElement) {
        text = this.toTag(child.tagName, text);
      }
      parent.insertBefore(this.document.createTextNode(text), child);
      parent.removeChild(child);
    });
  };

  private toTag(tagName: string, text: string = ''): string {
    switch (tagName) {
      case 'BR':
        return this.createTag(NodeTagType.NEW_LINE);
      case 'B':
      case 'STRONG':
        return this.createTag(NodeTagType.BOLD, text);
      case 'I':
        return this.createTag(NodeTagType.ITALIC, text);
      case 'U':
        return this.createTag(NodeTagType.UNDERLINE, text);
      default:
        return this.createTag(NodeTagType.LINE, text);
    }
  }

  private createTag(
    type: NodeTagType,
    content: string = '',
    attr: Map<string, string> = new Map()
  ): string {
    if (nodeTagTypeEnum.isSelfClosing(type)) {
      return `[${type}/]`;
    }
    if (attr.size > 0) {
      let attrString = Array.from(attr.entries())
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      return `[${type} ${attrString}]${content}[/${type}]`;
    } else {
      return `[${type}]${content}[/${type}]`;
    }
  }

  private parseTagAttr(attrText: string): Record<string, string> {
    const attr: Record<string, string> = {};
    const regex = new RegExp(this.tagAttributeRegex);
    let match = null;
    do {
      match = regex.exec(attrText);
      if (match === null) {
        break;
      }
      const { nameGroup, contentGroup } =
        match.groups as any as AttrMatchGroups;
      attr[nameGroup] = contentGroup;
    } while (true);
    return attr;
  }
}
