import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

export type DateRange = [Dayjs, Dayjs] | null;

export function textMatches(search: string | undefined, ...values: Array<string | undefined>) {
  if (!search?.trim()) {
    return true;
  }
  const keyword = search.trim().toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(keyword));
}

export function dateInRange(value: string | undefined, range: DateRange) {
  if (!range) {
    return true;
  }
  if (!value) {
    return false;
  }
  const time = dayjs(value).valueOf();
  return time >= range[0].startOf('day').valueOf() && time <= range[1].endOf('day').valueOf();
}

export function dateSpanOverlapsRange(start: string | undefined, end: string | undefined, range: DateRange) {
  if (!range) {
    return true;
  }
  if (!start && !end) {
    return false;
  }
  const startTime = start ? dayjs(start).startOf('day').valueOf() : Number.NEGATIVE_INFINITY;
  const endTime = end ? dayjs(end).endOf('day').valueOf() : Number.POSITIVE_INFINITY;
  return startTime <= range[1].endOf('day').valueOf() && endTime >= range[0].startOf('day').valueOf();
}
