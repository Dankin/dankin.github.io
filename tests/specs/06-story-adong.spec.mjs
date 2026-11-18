import { runIfMain } from '../lib/spec.mjs';
import { storySpec } from '../lib/storyspec.mjs';
const spec = storySpec({ id: '06-story-adong', storyId: 'adong_story', title: '阿东', pre: ['xiaomi_story','afu_story','laozhou_story','xiaolan_story'], checklist: [], timeout: 1200000 });
export default spec;
await runIfMain(import.meta.url, spec);
