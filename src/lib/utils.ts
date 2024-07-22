import type { NostrEvent } from 'nostr-tools';
import LRUCache from 'mnemonist/lru-cache';
import type { CacheMap } from 'dataloader';

export function formatDate(unixtimestamp: number) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  const date = new Date(unixtimestamp * 1000);
  const dateday = date.toISOString().split('T')[0];

  const now = Date.now();

  const today = new Date(now).toISOString().split('T')[0];
  if (dateday === today) return 'today';

  const yesterday = new Date(now - 24 * 3600 * 1000).toISOString().split('T')[0];
  if (dateday === yesterday) return 'yesterday';

  if (unixtimestamp > now / 1000 - 24 * 3600 * 90) {
    return Math.round((now / 1000 - unixtimestamp) / (24 * 3600)) + ' days ago';
  }

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  const formattedDate = `${day} ${month} ${year}`;
  return 'on ' + formattedDate;
}

let serial = 1;

export function next(): number {
  return serial++;
}

export function scrollCardIntoView(el: number | string | HTMLElement, wait: boolean) {
  function scrollCard() {
    const element =
      el instanceof HTMLElement ? el : document.querySelector(`[id^="wikicard-${el}"]`);
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      inline: 'start'
    });
  }

  if (wait) {
    setTimeout(() => {
      scrollCard();
    }, 1);
  } else {
    scrollCard();
  }
}

export function isElementInViewport(el: number | string | HTMLElement) {
  const element = el instanceof HTMLElement ? el : document.querySelector(`[id^="wikicard-${el}"]`);
  if (!element) return;

  const rect = element.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function getParentCard(el: HTMLElement): HTMLElement | null {
  let curr: HTMLElement | null = el;
  while (curr && !curr.id?.startsWith('wikicard')) {
    curr = curr.parentElement;
  }
  return curr;
}

export function normalizeArticleName(input: string): string {
  return input.trim().toLowerCase().replace(/\W/g, '-');
}

export function getA(event: NostrEvent) {
  const dTag = event.tags.find(([t, v]) => t === 'd' && v)?.[1] || '';
  return `${event.kind}:${event.pubkey}:${dTag}`;
}

export function dataloaderCache<V>(): CacheMap<string, Promise<V>> {
  const cache = new LRUCache<string, Promise<V>>(2000);
  (cache as any).delete = (_key: string) => {};
  return cache as unknown as CacheMap<string, Promise<V>>;
}

export function hashbow(input: string, lightness: number): string {
  let value = 0;
  for (let i = 0; i < input.length; i++) {
    value += input.charCodeAt(i);
  }
  value **= 17;
  return `hsla(${value % 360}, 76%, ${lightness}%, 1)`;
}

export function getTagOr(event: NostrEvent, tagName: string, dflt: string = '') {
  return event.tags.find(([t]) => t === tagName)?.[1] || dflt;
}

export function isHex32(input: string): boolean {
  return Boolean(input.match(/^[a-f0-9]{64}$/));
}

export function isATag(input: string): boolean {
  return Boolean(input.match(/^\d+:[0-9a-f]{64}:[^:]+$/));
}

export function urlWithoutScheme(url: string): string {
  return url.replace('wss://', '').replace(/\/+$/, '');
}

export function unique<A>(...arrs: A[][]): A[] {
  const result = [];
  for (let i = 0; i < arrs.length; i++) {
    const arr = arrs[i];
    for (let j = 0; j < arr.length; j++) {
      const item = arr[j];
      if (result.indexOf(item) !== -1) continue;
      result.push(item);
    }
  }
  return result;
}

export function addUniqueTaggedReplaceable(haystack: NostrEvent[], needle: NostrEvent): boolean {
  const idx = haystack.findIndex(
    (evt) => evt.pubkey === needle.pubkey && getTagOr(evt, 'd') === getTagOr(needle, 'd')
  );
  if (idx === -1) {
    haystack.push(needle);
    return true;
  }
  if (haystack[idx].created_at < needle.created_at) {
    haystack[idx] = needle;
    return true;
  }

  return false;
}

export function turnWikilinksIntoAsciidocLinks(content: string): string {
  return content.replace(/\[\[(.*?)\]\]/g, (_: any, content: any) => {
    let [target, display] = content.split('|');
    display = display || target;
    target = normalizeArticleName(target);
    return `link:wikilink:${target}[${display}]`;
  });
}
