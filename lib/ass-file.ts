import { writeFile } from "fs/promises";
import { finalizeAssContent } from "./ass-text";

export async function writeAssFile(path: string, content: string): Promise<void> {
  await writeFile(path, finalizeAssContent(content), "utf8");
}
