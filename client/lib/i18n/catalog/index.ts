import type { PhraseCatalog } from "../phrases";
import content from "./content";
import dynamic from "./dynamic";
import ePermit from "./e-permit";
import lib from "./lib";
import ui_1 from "./ui-1";
import ui_2 from "./ui-2";
import ui_3 from "./ui-3";

/**
 * Hindi/Marathi catalogue, split by area. Loaded lazily by
 * `loadPhraseCatalog()` so English users never download it.
 */
const parts: PhraseCatalog[] = [content, dynamic, lib, ui_1, ui_2, ui_3, ePermit];

const catalog: PhraseCatalog = Object.assign({}, ...parts);

export default catalog;
