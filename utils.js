import fs from "fs/promises";

export const loadData = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
};

export const saveData = async (filePath, data) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
  } catch (error) {
    console.error(`Error writing to file ${filePath}:`, error);
  }
};
