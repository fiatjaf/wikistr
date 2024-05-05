import type { Tab } from './types';

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
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  const formattedDate = `${day} ${month} ${year}`;
  return formattedDate;
}

let serial = 1;

export function next(): number {
  return serial++;
}

export function scrollTabIntoView(el: number | string | HTMLElement, wait: boolean) {
  function scrollTab() {
    const element =
      el instanceof HTMLElement ? el : document.querySelector(`[id^="wikitab-${el}"]`);
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      inline: 'start'
    });
  }

  if (wait) {
    setTimeout(() => {
      scrollTab();
    }, 1);
  } else {
    scrollTab();
  }
}

export function isElementInViewport(el: number | string | HTMLElement) {
  const element = el instanceof HTMLElement ? el : document.querySelector(`[id^="wikitab-${el}"]`);
  if (!element) return;

  const rect = element.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function toURL(tab: Tab): string | null {
  switch (tab.type) {
    case 'find':
      return tab.data;
    case 'article':
      return tab.data;
    case 'relay':
      return encodeURIComponent(tab.data);
  }
  return null;
}

export function getParentCard(el: HTMLElement): HTMLElement | null {
  let curr: HTMLElement | null = el;
  while (curr && !curr.id?.startsWith('wikitab')) {
    curr = curr.parentElement;
  }
  return curr;
}

export function normalizeArticleName(input: string): string {
  return input.trim().toLowerCase().replace(/\W/g, '-');
}
