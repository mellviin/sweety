import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

test("database query calls do not interpolate template literals into SQL", async () => {
  const files = await getJavaScriptFiles(join(sourceDirectory, ".."));
  const unsafeQueries = [];

  for (const file of files) {
    if (file.endsWith(".test.js")) {
      continue;
    }

    // Files are discovered recursively under the fixed server source directory.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- the path is bounded by getJavaScriptFiles.
    const source = await readFile(file, "utf8");
    const interpolatedQuery = /\.query\s*\(\s*`[^`]*\$\{/s;
    if (interpolatedQuery.test(source)) {
      unsafeQueries.push(file);
    }
  }

  expect(unsafeQueries).toEqual([]);
});

async function getJavaScriptFiles(directory) {
  // Recursion starts at sourceDirectory and only descends into its child directories.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the path stays within the fixed server source tree.
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return getJavaScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  }));

  return files.flat();
}
