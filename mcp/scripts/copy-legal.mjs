// Copies the license files of the repository into the package, which npm packs from this folder.
import { copyFileSync } from "node:fs";

for (const name of ["LICENSE", "NOTICE"]) {
  copyFileSync(new URL(`../../${name}`, import.meta.url), new URL(`../${name}`, import.meta.url));
}
