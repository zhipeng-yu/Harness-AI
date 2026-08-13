import { getChapters } from "../content/chapters/registry";

const chapters = getChapters();
const published = chapters.filter((chapter) => chapter.status === "published").length;
console.log(`Validated ${chapters.length} chapters (${published} published).`);
