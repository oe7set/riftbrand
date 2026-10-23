import { hitSourceSchema } from '../../content/schema';

/** Player damage sources for the tally: the hit sources plus damage over time. */
export const DEALT_SOURCES = [...hitSourceSchema.options, 'status'] as const;
export const DEALT_STATUS_INDEX = DEALT_SOURCES.length - 1;
